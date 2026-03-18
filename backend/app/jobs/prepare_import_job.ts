import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookImportPreparationService } from '#services/book-import/book_import_preparation_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class PrepareImportJob extends Job {
  static get concurrency() {
    return 2
  }

  constructor(private service: BookImportPreparationService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
