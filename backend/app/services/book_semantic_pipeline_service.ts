import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'
import { ImportStateService } from '#services/import_state_service'
import BuildContentAndVocabSeedJob from '#jobs/build_content_and_vocab_seed_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookSemanticPipelineService {
  constructor(
    private orchestrator: BookImportOrchestratorService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.SEMANTIC_CLEAN
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
      progress
    )

    try {
      const sourceFile = await this.orchestrator.validateSourceFile(book)
      const parsed = await this.orchestrator.parseSourceFile(sourceFile)
      const metadata = await this.orchestrator.semanticExtractMetadata({ book, parsed })
      const cleanedChapters = await this.orchestrator.semanticCleanChapters(parsed)

      await book
        .merge({
          title: metadata.title || book.title,
          author: metadata.author,
          description: metadata.description,
        })
        .save()

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
        progress,
        {
          title: metadata.title,
          author: metadata.author,
          chapterCount: cleanedChapters.length,
        }
      )

      await BuildContentAndVocabSeedJob.dispatch({ bookId, runId, userId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
        message
      )
      throw error
    }
  }
}
