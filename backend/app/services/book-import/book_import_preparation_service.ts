import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import SemanticCleanJob from '#jobs/semantic_clean_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookImportPreparationService {
  constructor(
    private orchestrator: BookImportOrchestratorService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.PREPARE_IMPORT
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.PREPARE_IMPORT,
      progress,
      { source: book.source, rawFilePath: book.rawFilePath }
    )

    try {
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const sourceFile = await this.orchestrator.validateSourceFile(book)
      const parsed = await this.orchestrator.parseSourceFile(sourceFile)
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.PREPARE_IMPORT,
        progress,
        {
          parsedChapters: parsed.chapters.length,
          parsedWordCount: parsed.wordCount,
        }
      )

      await SemanticCleanJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
          }),
        }
      )
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        return
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.PREPARE_IMPORT,
        message
      )
      throw error
    }
  }
}
