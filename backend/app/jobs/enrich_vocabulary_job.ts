import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookVocabularyPipelineService } from '#services/book_vocabulary_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class EnrichVocabularyJob extends Job {
  static get concurrency() {
    return 2
  }

  constructor(private service: BookVocabularyPipelineService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
