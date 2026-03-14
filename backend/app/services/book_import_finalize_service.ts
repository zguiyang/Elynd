import { inject } from '@adonisjs/core'
import Book from '#models/book'
import BookProcessingRunLog from '#models/book_processing_run_log'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'
import { ImportStateService } from '#services/import_state_service'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookImportFinalizeService {
  constructor(
    private orchestrator: BookImportOrchestratorService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId } = payload
    const book = await Book.findOrFail(bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.FINALIZE_IMPORT
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.FINALIZE_IMPORT,
      progress
    )

    try {
      const published = await this.orchestrator.finalizePublish(book)
      if (!published) {
        throw new Error('Finalize publish blocked by unfinished sub tasks')
      }

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.FINALIZE_IMPORT,
        progress,
        { published: true }
      )

      const runLog = await BookProcessingRunLog.findOrFail(runId)
      runLog.status = 'success'
      runLog.currentStep = BOOK_IMPORT_STEP.COMPLETED
      runLog.progress = 100
      runLog.errorCode = null
      runLog.errorMessage = null
      runLog.finishedAt = runLog.finishedAt || step.finishedAt
      await runLog.save()

      await this.importStateService.markBookReady(bookId)
      await Book.query().where('id', bookId).update({ isPublished: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.FINALIZE_IMPORT,
        message
      )
      throw error
    }
  }
}
