import { inject } from '@adonisjs/core'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'
import { ImportStateService } from '#services/import_state_service'
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

      const vocabulary = await this.orchestrator.extractVocabulary(book)
      const levelResult = await this.orchestrator.assignDifficultyLevel(book)

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
        progress,
        {
          contentHash: persisted.contentHash,
          vocabularyCount: vocabulary.length,
          difficultyLevel: levelResult.difficultyLevel,
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
