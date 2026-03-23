import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookImportFinalizeService } from '#services/book-import/pipeline/book_import_finalize_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class FinalizeImportJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookImportFinalizeService)
    await service.run(payload)
  }
}
