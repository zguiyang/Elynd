import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookSemanticPipelineService } from '#services/book-import/book_semantic_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class SemanticCleanJob extends Job {
  static get concurrency() {
    return 2
  }

  constructor(private service: BookSemanticPipelineService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
