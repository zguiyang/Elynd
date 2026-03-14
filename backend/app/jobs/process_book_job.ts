import { Job } from 'adonisjs-jobs'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import { BookProcessingLogService } from '#services/book_processing_log_service'
import PrepareImportJob from '#jobs/prepare_import_job'

interface ProcessBookPayload {
  bookId: number
  userId: number
}

export default class ProcessBookJob extends Job {
  static get concurrency() {
    return 2
  }

  private logService = new BookProcessingLogService()

  async handle(payload: ProcessBookPayload) {
    const { bookId, userId } = payload
    const book = await Book.find(bookId)
    if (!book) {
      throw new Exception(`Book ${bookId} not found`, { status: 404 })
    }

    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')

    logger.info({ bookId, runId: runLog.id }, 'Starting serial book import pipeline')

    await PrepareImportJob.dispatch({
      bookId,
      userId,
      runId: runLog.id,
    })
  }
}
