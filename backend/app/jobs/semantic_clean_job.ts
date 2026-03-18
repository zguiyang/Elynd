import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookSemanticPipelineService } from '#services/book-import/book_semantic_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class SemanticCleanJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookSemanticPipelineService)
    await service.run(payload)
  }
}
