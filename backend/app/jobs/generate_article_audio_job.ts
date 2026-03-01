import { DateTime } from 'luxon'
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { TtsService } from '#services/tts_service'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'

interface GenerateArticleAudioPayload {
  articleId: number
}

export default class GenerateArticleAudioJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateArticleAudioPayload) {
    const { articleId } = payload

    logger.info(`Starting audio generation for article ${articleId}`)

    const article = await Article.find(articleId)

    if (!article) {
      throw new Error(`Article ${articleId} not found`)
    }

    try {
      await article.merge({ audioStatus: 'processing' }).save()

      const chapters = await ArticleChapter.query()
        .where('articleId', articleId)
        .orderBy('chapterIndex', 'asc')

      const fullText = chapters.map((chapter) => chapter.content).join('\n\n')

      const ttsService = await app.container.make(TtsService)

      const result = await ttsService.generateAudio(fullText, articleId)

      await article
        .merge({
          audioUrl: result.audioUrl,
          audioStatus: 'completed',
          audioTiming: result.timing as Record<string, unknown> | null,
          audioGeneratedAt: DateTime.now(),
        })
        .save()

      logger.info(`Audio generation completed for article ${articleId}`)
    } catch (error) {
      logger.error({ err: error, articleId }, 'Audio generation failed')

      if (article) {
        await article.merge({ audioStatus: 'failed' }).save()
      }

      throw error
    }
  }
}
