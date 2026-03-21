import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
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
    await this.importStateService.assertImportNotCancelled(runId, bookId)
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
      logger.info(
        { bookId, runId, stepKey: BOOK_IMPORT_STEP.SEMANTIC_CLEAN },
        '[SemanticPipeline] Step run started'
      )
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const sourceFile = await this.orchestrator.validateSourceFile(book)
      const parsed = await this.orchestrator.parseSourceFile(sourceFile)
      const metadata = await this.orchestrator.semanticExtractMetadata({ book, parsed })
      const cleanedChapters = await this.orchestrator.semanticCleanChapters(parsed)
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const cleanedArtifactPath = await this.orchestrator.writeChapterArtifact({
        runId,
        bookId,
        stepKey: BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
        chapters: cleanedChapters,
      })

      await book
        .merge({
          title: metadata.title || book.title,
          author: metadata.author,
          description: metadata.description,
        })
        .save()
      await this.importStateService.assertImportNotCancelled(runId, bookId)

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
          cleanedChaptersArtifactPath: cleanedArtifactPath,
        }
      )

      await BuildContentAndVocabSeedJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
          }),
        }
      )
      logger.info(
        {
          bookId,
          runId,
          stepKey: BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
          chapterCount: cleanedChapters.length,
        },
        '[SemanticPipeline] Step run completed'
      )
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        return
      }
      logger.error(
        { bookId, runId, stepKey: BOOK_IMPORT_STEP.SEMANTIC_CLEAN, err: error },
        '[SemanticPipeline] Step run failed'
      )
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
