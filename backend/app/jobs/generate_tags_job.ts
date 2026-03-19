import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookTagPipelineService } from '#services/book-import/book_tag_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class GenerateTagsJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookTagPipelineService)
    await service.run(payload)
  }
}
