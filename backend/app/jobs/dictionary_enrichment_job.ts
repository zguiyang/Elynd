import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { DictionaryService } from '#services/dictionary/dictionary_service'
import type { DictionaryEnrichmentPayload } from '#services/dictionary/dictionary_service'

export default class DictionaryEnrichmentJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: DictionaryEnrichmentPayload) {
    logger.info(
      {
        word: payload.word,
        mode: payload.mode,
        bookId: payload.bookId ?? null,
        chapterIndex: payload.chapterIndex ?? null,
      },
      'Dictionary enrichment job started'
    )

    const dictionaryService = await app.container.make(DictionaryService)
    await dictionaryService.processAsyncEnrichment(payload)

    logger.info(
      {
        word: payload.word,
        mode: payload.mode,
        bookId: payload.bookId ?? null,
        chapterIndex: payload.chapterIndex ?? null,
      },
      'Dictionary enrichment job completed'
    )
  }
}
