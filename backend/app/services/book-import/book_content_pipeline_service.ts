import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import EnrichVocabularyJob from '#jobs/enrich_vocabulary_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookContentPipelineService {
  constructor(
    private orchestrator: BookImportOrchestratorService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED
    )
    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
      progress
    )

    try {
      await this.importStateService.assertImportNotCancelled(runId, bookId)
      const validationOutput = await this.orchestrator.getSuccessfulStepOutputRef(
        runId,
        BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT
      )
      const validatedArtifactPath = this.orchestrator.requireOutputRefString(
        validationOutput,
        'validatedChaptersArtifactPath'
      )
      const cleanedChapters = await this.orchestrator.readChapterArtifact(validatedArtifactPath)
      const persisted = await this.orchestrator.persistChaptersAndContentHash({
        book,
        metadata: {
          title: book.title,
          author: book.author,
          description: book.description,
        },
        cleanedChapters,
      })
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      const vocabulary = await this.orchestrator.extractVocabulary(book)
      const levelResult = await this.orchestrator.assignBookLevel(book)
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
        progress,
        {
          contentHash: persisted.contentHash,
          vocabularyCount: vocabulary.length,
          levelId: levelResult.levelId,
          levelCode: levelResult.levelCode,
          classifiedBy: levelResult.classifiedBy,
          levelReason: levelResult.reason,
        }
      )

      await EnrichVocabularyJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
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
        BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
        message
      )
      throw error
    }
  }
}
