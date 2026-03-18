import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookImportFinalizeService } from '#services/book-import/book_import_finalize_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class FinalizeImportJob extends Job {
  static get concurrency() {
    return 1
  }

  constructor(private service: BookImportFinalizeService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
