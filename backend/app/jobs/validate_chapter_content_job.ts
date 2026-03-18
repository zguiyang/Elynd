import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookChapterValidationPipelineService } from '#services/book-import/book_chapter_validation_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class ValidateChapterContentJob extends Job {
  static get concurrency() {
    return 2
  }

  constructor(private service: BookChapterValidationPipelineService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
