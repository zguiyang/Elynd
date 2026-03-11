import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import crypto from 'node:crypto'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookProcessingStepLog from '#models/book_processing_step_log'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'
import { TransmitService } from '#services/transmit_service'
import { BookProcessingLogService } from '#services/book_processing_log_service'

interface ProcessBookPayload {
  bookId: number
  userId: number
}

export default class ProcessBookJob extends Job {
  static get concurrency() {
    return 2
  }

  private logService = new BookProcessingLogService()

  /**
   * Check if a step has already been completed successfully with the same input
   * Used for resuming interrupted jobs
   */
  private async checkStepCompleted(
    bookId: number,
    stepKey: string,
    itemKey?: string | null,
    inputHash?: string | null
  ): Promise<boolean> {
    const successfulStep = await this.logService.findSuccessfulStep(
      bookId,
      stepKey,
      itemKey,
      inputHash
    )
    return successfulStep !== null
  }

  async handle(payload: ProcessBookPayload) {
    const { bookId, userId } = payload
    const book = await Book.find(bookId)

    if (!book) {
      throw new Error(`Book ${bookId} not found`)
    }

    // Get or create active run log for this job
    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')

    const transmitService = await app.container.make(TransmitService)
    const analyzer = await app.container.make(VocabularyAnalyzerService)
    const channel = `user:${userId}:book_import`

    const pushStatus = async (data: {
      status: 'processing' | 'ready' | 'failed'
      processingStep: string
      processingProgress: number
      message: string
      processingError?: string | null
    }) => {
      await transmitService.toUser(channel, 'book:import-status', {
        bookId,
        ...data,
      })
    }

    try {
      // Step 1: Analyze vocabulary
      const step1Key = 'analyze_vocabulary'
      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      const fullContent = chapters.map((chapter) => chapter.content).join('\n\n')
      const contentHash = crypto.createHash('md5').update(fullContent).digest('hex')

      await this.logService.advanceRun(runLog.id, step1Key, 20)

      const step1Completed = await this.checkStepCompleted(bookId, step1Key, undefined, contentHash)

      if (step1Completed) {
        logger.info({ bookId, step: step1Key }, 'Skipping already completed step')
        const existingSteps = await BookProcessingStepLog.query()
          .where('bookId', bookId)
          .where('stepKey', step1Key)
          .where('status', 'success')
        if (existingSteps.length > 0) {
          await this.logService.startStep(runLog.id, bookId, step1Key, undefined, contentHash)
          const allNewSteps = await BookProcessingStepLog.query()
            .where('runLogId', runLog.id)
            .orderBy('id', 'desc')
          if (allNewSteps.length > 0) {
            await this.logService.skipStep(allNewSteps[0].id)
          }
        }
      } else {
        const step1Log = await this.logService.startStep(
          runLog.id,
          bookId,
          step1Key,
          undefined,
          contentHash
        )

        try {
          await book
            .merge({
              status: 'processing',
              processingStep: 'analyzing_vocabulary',
              processingProgress: 20,
              processingError: null,
            })
            .save()

          await pushStatus({
            status: 'processing',
            processingStep: 'analyzing_vocabulary',
            processingProgress: 20,
            message: 'Analyzing vocabulary',
          })

          const vocabulary = analyzer.extractVocabulary(fullContent)

          await this.logService.completeStep(step1Log.id, { vocabularyCount: vocabulary.length })
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error'
          await this.logService.failStep(step1Log.id, errorMessage)
          throw stepError
        }
      }

      // Step 2: Generate meanings
      const step2Key = 'generate_meanings'
      const step2InputHash = crypto
        .createHash('md5')
        .update(book.title + '-meanings')
        .digest('hex')

      await this.logService.advanceRun(runLog.id, step2Key, 50)

      const step2Completed = await this.checkStepCompleted(
        bookId,
        step2Key,
        undefined,
        step2InputHash
      )

      if (step2Completed) {
        logger.info({ bookId, step: step2Key }, 'Skipping already completed step')
      } else {
        const step2Log = await this.logService.startStep(
          runLog.id,
          bookId,
          step2Key,
          undefined,
          step2InputHash
        )

        try {
          await book
            .merge({
              processingStep: 'generating_meanings',
              processingProgress: 50,
            })
            .save()

          await pushStatus({
            status: 'processing',
            processingStep: 'generating_meanings',
            processingProgress: 50,
            message: 'Generating meanings',
          })

          const vocabulary = analyzer.extractVocabulary(fullContent)
          const withMeanings = await analyzer.generateMeaningsWithAI(book.title, vocabulary)
          await analyzer.saveVocabulary(bookId, withMeanings)

          await this.logService.completeStep(step2Log.id, { wordsProcessed: withMeanings.length })
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error'
          await this.logService.failStep(step2Log.id, errorMessage)
          throw stepError
        }
      }

      // Step 3: Queue audio generation
      const step3Key = 'queue_audio'

      await this.logService.advanceRun(runLog.id, step3Key, 80)

      const step3Completed = await this.checkStepCompleted(bookId, step3Key, undefined, undefined)

      if (step3Completed) {
        logger.info({ bookId, step: step3Key }, 'Skipping already completed step')
      } else {
        const step3Log = await this.logService.startStep(
          runLog.id,
          bookId,
          step3Key,
          undefined,
          undefined
        )

        try {
          await book
            .merge({
              processingStep: 'generating_audio',
              processingProgress: 80,
            })
            .save()

          await pushStatus({
            status: 'processing',
            processingStep: 'generating_audio',
            processingProgress: 80,
            message: 'Queuing audio generation',
          })

          await GenerateBookAudioJob.dispatch({ bookId })

          await this.logService.completeStep(step3Log.id, { audioJobDispatched: true })
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error'
          await this.logService.failStep(step3Log.id, errorMessage)
          throw stepError
        }
      }

      // Complete the run (but NOT the book status - audio is handled separately)
      await this.logService.completeRun(runLog.id)

      // Note: We do NOT set book.status = 'ready' here
      // Audio generation is handled by GenerateBookAudioJob
      // The book will be marked ready after audio generation completes

      await pushStatus({
        status: 'processing', // Keep as processing until audio is done
        processingStep: 'audio_queued',
        processingProgress: 100,
        message: 'Audio generation queued',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'ProcessBookJob failed')

      // Mark run as failed
      await this.logService.failRun(runLog.id, message)

      await book
        .merge({
          status: 'failed',
          processingError: message,
        })
        .save()

      await pushStatus({
        status: 'failed',
        processingStep: book.processingStep || 'unknown',
        processingProgress: book.processingProgress || 0,
        message: 'Book processing failed',
        processingError: message,
      })

      throw error
    }
  }
}
