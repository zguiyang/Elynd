import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { BookAudioPipelineService } from '#services/book-import/pipeline/book_audio_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

export default class GenerateTtsJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: SerialImportPayload) {
    const service = await app.container.make(BookAudioPipelineService)
    await service.run(payload)
  }
}
