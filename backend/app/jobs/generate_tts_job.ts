import { Job } from 'adonisjs-jobs'
import { inject } from '@adonisjs/core'
import { BookAudioPipelineService } from '#services/book-import/book_audio_pipeline_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export default class GenerateTtsJob extends Job {
  static get concurrency() {
    return 1
  }

  constructor(private service: BookAudioPipelineService) {
    super()
  }

  async handle(payload: SerialImportPayload) {
    await this.service.run(payload)
  }
}
