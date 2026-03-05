import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { DictionaryService } from '#services/dictionary_service'
import Article from '#models/article'
import ArticleVocabulary from '#models/article_vocabulary'

interface GenerateVocabularyPayload {
  articleId: number
}

export default class GenerateVocabularyJob extends Job {
  static get concurrency() {
    return 3
  }

  async handle(payload: GenerateVocabularyPayload) {
    const { articleId } = payload

    logger.info(`Starting vocabulary details generation for article ${articleId}`)

    const article = await Article.find(articleId)

    if (!article) {
      throw new Error(`Article ${articleId} not found`)
    }

    const vocabularies = await ArticleVocabulary.query().where('articleId', articleId)

    if (vocabularies.length === 0) {
      logger.info(`No vocabulary found for article ${articleId}`)
      return
    }

    const words = vocabularies.map((v) => v.word)

    try {
      const dictionaryService = await app.container.make(DictionaryService)

      const results = await dictionaryService.lookupBatch(words)

      for (const vocabulary of vocabularies) {
        const entry = results.get(vocabulary.word.toLowerCase())

        if (entry) {
          const audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || null
          const phoneticText = entry.phonetic || entry.phonetics?.[0]?.text || null

          await vocabulary
            .merge({
              phoneticText,
              phoneticAudio: audioUrl,
              details: {
                meanings: entry.meanings,
              },
            })
            .save()
        }
      }

      logger.info(
        {
          articleId,
          total: vocabularies.length,
          updated: Array.from(results.values()).filter((v) => v !== null).length,
        },
        'Vocabulary details generation completed'
      )
    } catch (error) {
      logger.error({ err: error, articleId }, 'Vocabulary details generation failed')
      throw error
    }
  }
}
