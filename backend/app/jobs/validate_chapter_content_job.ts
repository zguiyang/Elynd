import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookChapterValidationPipelineService } from '#services/book-import/book_chapter_validation_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class ValidateChapterContentJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookChapterValidationPipelineService)
    await service.run(payload)
  }
}
