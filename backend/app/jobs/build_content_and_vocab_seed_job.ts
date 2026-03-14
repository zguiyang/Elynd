import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookContentPipelineService } from '#services/book_content_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class BuildContentAndVocabSeedJob extends Job {
  static get concurrency() {
    return 2
  }

  constructor(private service: BookContentPipelineService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
