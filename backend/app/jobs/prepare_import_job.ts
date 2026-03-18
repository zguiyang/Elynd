import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookImportPreparationService } from '#services/book-import/book_import_preparation_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class PrepareImportJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookImportPreparationService)
    await service.run(payload)
  }
}
