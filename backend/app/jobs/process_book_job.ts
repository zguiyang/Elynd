import { Job } from 'adonisjs-jobs'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import { BookProcessingLogService } from '#services/book-import/book_processing_log_service'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import PrepareImportJob from '#jobs/prepare_import_job'
import { BOOK_IMPORT_STEP } from '#constants'

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

    await PrepareImportJob.dispatch(
      {
        bookId,
        userId,
        runId: runLog.id,
      },
      {
        jobId: BookImportOrchestratorService.buildPipelineJobId({
          runId: runLog.id,
          bookId,
          stepKey: BOOK_IMPORT_STEP.PREPARE_IMPORT,
        }),
      }
    )
  }
}
