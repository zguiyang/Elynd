import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { ChapterTranslationService } from '#services/chapter_translation_service'

interface TranslateChapterPayload {
  translationId: number
}

export default class TranslateChapterJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: TranslateChapterPayload) {
    const service = await app.container.make(ChapterTranslationService)
    await service.processTranslation(payload.translationId)
  }
}
