import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookVocabularyPipelineService } from '#services/book-import/book_vocabulary_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class EnrichVocabularyJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookVocabularyPipelineService)
    await service.run(payload)
  }
}
