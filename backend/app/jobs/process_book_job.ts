import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import { BOOK_IMPORT_PROGRESS, BOOK_IMPORT_STEP } from '#constants'
import { TransmitService } from '#services/transmit_service'
import { BookProcessingLogService } from '#services/book_processing_log_service'
import { BookImportOrchestratorService } from '#services/book_import_orchestrator_service'

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
      throw new Error(`Book ${bookId} not found`)
    }

    const transmitService = await app.container.make(TransmitService)
    const orchestrator = await app.container.make(BookImportOrchestratorService)
    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')
    const channel = `user:${userId}:book_import`

    const pushStatus = async () => {
      await transmitService.toUser(channel, 'book:import-status', {
        bookId: book.id,
        status: book.status,
        processingStep: book.processingStep,
        processingProgress: book.processingProgress,
        processingError: book.processingError
      })
    }

    const writeGlobal = async (
      step: string,
      progress: number,
      status: 'processing' | 'ready' | 'failed' = 'processing',
      error: string | null = null
    ) => {
      await this.logService.advanceRun(runLog.id, step, progress)
      await book
        .merge({
          status,
          processingStep: step,
          processingProgress: progress,
          processingError: error
        })
        .save()
      await pushStatus()
    }

    let currentStepLogId: number | null = null
    let currentInputSummary: Record<string, unknown> | null = null

    const startStep = async (stepKey: string, inputSummary: Record<string, unknown>, itemKey?: string) => {
      currentInputSummary = inputSummary
      const payloadData = orchestrator.buildStepPayload(inputSummary)
      const stepLog = await this.logService.startStep(
        runLog.id,
        book.id,
        stepKey,
        itemKey,
        String(payloadData.input_hash)
      )
      currentStepLogId = stepLog.id
      await writeGlobal(stepKey, BookImportOrchestratorService.getBaseProgressByStep(stepKey))
      return stepLog.id
    }

    const completeStep = async (resultSummary: Record<string, unknown>) => {
      if (!currentStepLogId || !currentInputSummary) {
        return
      }
      const payloadData = orchestrator.buildStepPayload(currentInputSummary, resultSummary)
      await this.logService.completeStep(currentStepLogId, payloadData.output_ref)
      currentStepLogId = null
      currentInputSummary = null
    }

    const failCurrentStep = async (error: unknown) => {
      if (!currentStepLogId || !currentInputSummary) {
        return
      }
      const message = error instanceof Error ? error.message : 'Unknown error'
      const payloadData = orchestrator.buildStepError(currentInputSummary, error)
      await this.logService.failStep(currentStepLogId, message, undefined, payloadData.output_ref)
    }

    try {
      await startStep(BOOK_IMPORT_STEP.RECEIVED, {
        bookId: book.id,
        source: book.source,
        rawFilePath: book.rawFilePath
      })
      await completeStep({ accepted: true })

      await startStep(BOOK_IMPORT_STEP.FILE_VALIDATING, {
        rawFilePath: book.rawFilePath,
        rawFileExt: book.rawFileExt
      })
      const sourceFile = await orchestrator.validateSourceFile(book)
      const parsed = await orchestrator.parseSourceFile(sourceFile)
      await completeStep({
        parsedChapters: parsed.chapters.length,
        parsedWordCount: parsed.wordCount
      })

      await startStep(BOOK_IMPORT_STEP.SEMANTIC_METADATA, {
        parsedTitle: parsed.title,
        chapterCount: parsed.chapters.length
      })
      const metadata = await orchestrator.semanticExtractMetadata({ book, parsed })
      await completeStep({
        title: metadata.title,
        author: metadata.author
      })

      await startStep(BOOK_IMPORT_STEP.SEMANTIC_CHAPTERS, {
        chapterCount: parsed.chapters.length
      })
      const cleanedChapters = await orchestrator.semanticCleanChapters(parsed)
      await completeStep({
        keptChapters: cleanedChapters.length
      })

      await startStep(BOOK_IMPORT_STEP.CONTENT_HASHING, {
        cleanedChapterCount: cleanedChapters.length
      })
      const persisted = await orchestrator.persistChaptersAndContentHash({
        book,
        metadata,
        cleanedChapters
      })
      await completeStep({
        contentHash: persisted.contentHash,
        wordCount: persisted.wordCount
      })

      await startStep(BOOK_IMPORT_STEP.VOCABULARY_EXTRACTING, {
        contentHash: persisted.contentHash
      })
      const vocabulary = await orchestrator.extractVocabulary(book)
      const levelResult = await orchestrator.assignDifficultyLevel(book)
      await completeStep({
        vocabularyCount: vocabulary.length,
        difficultyLevel: levelResult.difficultyLevel,
        uniqueLemmaCount: levelResult.uniqueLemmaCount
      })

      await startStep(BOOK_IMPORT_STEP.PARALLEL_PROCESSING, {
        bookId: book.id,
        contentHash: persisted.contentHash
      })
      await orchestrator.dispatchParallelJobs(book.id)

      const parallelStartProgress =
        BOOK_IMPORT_PROGRESS.IMPORT_RECEIVED +
        BOOK_IMPORT_PROGRESS.FILE_VALIDATING +
        BOOK_IMPORT_PROGRESS.SEMANTIC_METADATA +
        BOOK_IMPORT_PROGRESS.SEMANTIC_CHAPTERS +
        BOOK_IMPORT_PROGRESS.CONTENT_HASHING +
        BOOK_IMPORT_PROGRESS.VOCABULARY_EXTRACTING

      const maxRounds = 900
      for (let round = 0; round < maxRounds; round++) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await book.refresh()

        if (book.audioStatus === 'failed' || book.vocabularyStatus === 'failed') {
          throw new Error('Parallel processing failed')
        }

        const parallelState = await orchestrator.reconcileParallelProgress(book)
        const progress = Math.min(
          95,
          parallelStartProgress +
            Math.round((BOOK_IMPORT_PROGRESS.PARALLEL_PROCESSING * parallelState.parallelProgress) / 100)
        )

        await writeGlobal(BOOK_IMPORT_STEP.PARALLEL_PROCESSING, progress)

        if (parallelState.audioDone && parallelState.vocabularyDone) {
          await completeStep({
            audioProgress: parallelState.audioProgress,
            vocabularyProgress: parallelState.vocabularyProgress,
            parallelProgress: parallelState.parallelProgress
          })
          break
        }

        if (round === maxRounds - 1) {
          throw new Error('Parallel processing timeout')
        }
      }

      await startStep(BOOK_IMPORT_STEP.FINALIZING_PUBLISH, {
        audioStatus: book.audioStatus,
        vocabularyStatus: book.vocabularyStatus
      })
      const published = await orchestrator.finalizePublish(book)
      if (!published) {
        throw new Error('Finalize publish blocked by unfinished sub tasks')
      }
      await completeStep({ published: true })

      await this.logService.completeRun(runLog.id)
      await writeGlobal(BOOK_IMPORT_STEP.COMPLETED, 100, 'ready', null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'ProcessBookJob failed')
      await failCurrentStep(error)
      await this.logService.failRun(runLog.id, message)
      await writeGlobal(BOOK_IMPORT_STEP.FAILED, 100, 'failed', message)
      throw error
    }
  }
}
