import { DateTime } from 'luxon'
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { TtsService } from '#services/tts_service'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'
import type { ChapterInput } from '#types/tts'

interface GenerateArticleAudioPayload {
  articleId: number
}

export default class GenerateArticleAudioJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateArticleAudioPayload) {
    const { articleId } = payload

    logger.info({ articleId }, 'Starting audio generation')

    const article = await Article.find(articleId)

    if (!article) {
      throw new Exception(`Article ${articleId} not found`, { status: 404 })
    }

    try {
      await article.merge({ audioStatus: 'processing' }).save()

      const chapters = await ArticleChapter.query()
        .where('articleId', articleId)
        .orderBy('chapterIndex', 'asc')
        .select(['chapterIndex', 'title', 'content'])

      const chapterInputs: ChapterInput[] = chapters.map((chapter) => ({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        content: chapter.content,
      }))

      const ttsService = await app.container.make(TtsService)

      const result = await ttsService.generateAudio(chapterInputs, articleId)

      await article
        .merge({
          audioUrl: result.audioUrl,
          audioStatus: 'completed',
          audioTiming: result.timing as unknown as Record<string, unknown> | null,
          audioGeneratedAt: DateTime.now(),
        })
        .save()

      logger.info({ articleId }, 'Audio generation completed')
    } catch (error) {
      logger.error({ err: error, articleId }, 'Audio generation failed')

      if (article) {
        await article.merge({ audioStatus: 'failed' }).save()
      }

      throw error
    }
  }
}
