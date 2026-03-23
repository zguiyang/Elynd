import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookContentPipelineService } from '#services/book-import/pipeline/book_content_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class BuildContentAndVocabSeedJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookContentPipelineService)
    await service.run(payload)
  }
}
