import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { ChapterTranslationService } from '#services/book/chapter_translation_service'

interface TranslateChapterPayload {
  translationId: number
  paragraphIndex?: number | null
}

export default class TranslateChapterJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: TranslateChapterPayload) {
    logger.info(
      { payload },
      `TranslateChapterJob started: translationId=${payload.translationId}, paragraphIndex=${payload.paragraphIndex ?? 'all'}`
    )

    const service = await app.container.make(ChapterTranslationService)
    try {
      if (typeof payload.paragraphIndex === 'number') {
        await service.processParagraph(payload.translationId, payload.paragraphIndex)
      } else {
        await service.processTranslation(payload.translationId)
      }
      logger.info(
        { translationId: payload.translationId },
        `TranslateChapterJob completed successfully`
      )
    } catch (error) {
      logger.error({ error, translationId: payload.translationId }, `TranslateChapterJob failed`)
      throw error
    }
  }
}
