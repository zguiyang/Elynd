import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { BookChapterValidationService } from '#services/book-parse/book_chapter_validation_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import BuildContentAndVocabSeedJob from '#jobs/build_content_and_vocab_seed_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookChapterValidationPipelineService {
  constructor(
    private orchestrator: BookImportOrchestratorService,
    private validationService: BookChapterValidationService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const startedAt = Date.now()
    await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)

    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT
    )

    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
      progress
    )

    try {
      logger.info({ bookId, runId }, '[ValidationPipeline] Step run started')
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const semanticOutput = await this.orchestrator.getSuccessfulStepOutputRef(
        runId,
        BOOK_IMPORT_STEP.SEMANTIC_CLEAN
      )
      const cleanedArtifactPath = this.orchestrator.requireOutputRefString(
        semanticOutput,
        'cleanedChaptersArtifactPath'
      )
      const cleanedChapters = await this.orchestrator.readChapterArtifact(cleanedArtifactPath)
      logger.info(
        {
          bookId,
          runId,
          cleanedArtifactPath,
          cleanedChapterCount: cleanedChapters.length,
        },
        '[ValidationPipeline] Loaded cleaned chapters artifact'
      )

      const validatedResult = await this.validationService.validateChapters(cleanedChapters)
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const validatedArtifactPath = await this.orchestrator.writeChapterArtifact({
        runId,
        bookId,
        stepKey: BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
        chapters: validatedResult.chapters,
      })

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
        progress,
        {
          ...validatedResult.stats,
          validatedChaptersArtifactPath: validatedArtifactPath,
        }
      )
      logger.info(
        {
          bookId,
          runId,
          validatedChapterCount: validatedResult.chapters.length,
          removedChapters: validatedResult.stats.removedChapters,
          reviewRetries: validatedResult.stats.reviewRetries,
          mergedShortChapters: validatedResult.stats.mergedShortChapters,
          elapsedMs: Date.now() - startedAt,
        },
        '[ValidationPipeline] Step run completed'
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
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        return
      }
      logger.error(
        {
          bookId,
          runId,
          elapsedMs: Date.now() - startedAt,
          err: error,
        },
        '[ValidationPipeline] Step run failed'
      )
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
        message
      )
      throw error
    }
  }
}
