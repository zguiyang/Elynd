import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import BookProcessingRunLog from '#models/book_processing_run_log'
import type { JobType } from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'

@inject()
export class BookProcessingLogService {
  /**
   * Get or create an active run log for the given book and job type
   * If an existing processing run exists, return it
   * Otherwise create a new run log
   */
  async getOrCreateActiveRun(bookId: number, jobType: JobType): Promise<BookProcessingRunLog> {
    // Find existing processing run for this book and job type
    const existingRun = await BookProcessingRunLog.query()
      .where('bookId', bookId)
      .where('jobType', jobType)
      .where('status', 'processing')
      .orderBy('startedAt', 'desc')
      .first()

    if (existingRun) {
      logger.info(
        { bookId, runId: existingRun.id, status: existingRun.status, jobType },
        'Book import run reused'
      )
      return existingRun
    }

    // Create new run log
    const runLog = new BookProcessingRunLog()
    runLog.bookId = bookId
    runLog.jobType = jobType
    runLog.status = 'processing'
    runLog.currentStep = null
    runLog.progress = 0
    runLog.startedAt = DateTime.now()
    await runLog.save()

    logger.info(
      { bookId, runId: runLog.id, status: runLog.status, jobType },
      'Book import run created'
    )

    return runLog
  }

  /**
   * Start a new run log for the given book and job type
   */
  async startRun(bookId: number, jobType: JobType): Promise<BookProcessingRunLog> {
    const runLog = new BookProcessingRunLog()
    runLog.bookId = bookId
    runLog.jobType = jobType
    runLog.status = 'processing'
    runLog.currentStep = null
    runLog.progress = 0
    runLog.startedAt = DateTime.now()
    await runLog.save()

    logger.info(
      {
        bookId,
        jobType,
        runId: runLog.id,
        status: runLog.status,
      },
      'Book import run started'
    )

    return runLog
  }

  /**
   * Advance the run log to the next step
   */
  async advanceRun(
    runId: number,
    currentStep: string,
    progress: number
  ): Promise<BookProcessingRunLog> {
    const runLog = await BookProcessingRunLog.findOrFail(runId)
    runLog.currentStep = currentStep
    runLog.progress = progress
    await runLog.save()

    logger.info({ runId, stepKey: currentStep, progress }, 'Book import run advanced')

    return runLog
  }

  /**
   * Mark the run as completed successfully
   */
  async completeRun(runId: number): Promise<BookProcessingRunLog> {
    const runLog = await BookProcessingRunLog.findOrFail(runId)
    runLog.status = 'success'
    runLog.progress = 100
    runLog.finishedAt = DateTime.now()
    runLog.durationMs = runLog.startedAt
      ? DateTime.now().toMillis() - runLog.startedAt.toMillis()
      : null
    await runLog.save()

    logger.info(
      { runId, status: runLog.status, durationMs: runLog.durationMs },
      'Book import run completed'
    )

    return runLog
  }

  /**
   * Mark the run as failed
   */
  async failRun(runId: number, error: string, errorCode?: string): Promise<BookProcessingRunLog> {
    const runLog = await BookProcessingRunLog.findOrFail(runId)
    runLog.status = 'failed'
    runLog.finishedAt = DateTime.now()
    runLog.durationMs = runLog.startedAt
      ? DateTime.now().toMillis() - runLog.startedAt.toMillis()
      : null
    runLog.errorMessage = error
    runLog.errorCode = errorCode || null
    await runLog.save()

    logger.error(
      { runId, errorCode: runLog.errorCode, durationMs: runLog.durationMs },
      'Book import run failed'
    )

    return runLog
  }

  /**
   * Start a new step log
   */
  async startStep(
    runLogId: number,
    bookId: number,
    stepKey: string,
    itemKey?: string,
    inputHash?: string
  ): Promise<BookProcessingStepLog> {
    const stepLog = new BookProcessingStepLog()
    stepLog.runLogId = runLogId
    stepLog.bookId = bookId
    stepLog.stepKey = stepKey
    stepLog.itemKey = itemKey || null
    stepLog.inputHash = inputHash || null
    stepLog.status = 'processing'
    stepLog.startedAt = DateTime.now()
    await stepLog.save()

    logger.info({ runLogId, bookId, stepKey, status: stepLog.status }, 'Book import step started')

    return stepLog
  }

  /**
   * Mark a step as completed successfully
   */
  async completeStep(
    stepLogId: number,
    outputRef?: Record<string, unknown>
  ): Promise<BookProcessingStepLog> {
    const stepLog = await BookProcessingStepLog.findOrFail(stepLogId)
    stepLog.status = 'success'
    stepLog.finishedAt = DateTime.now()
    stepLog.durationMs = stepLog.startedAt
      ? DateTime.now().toMillis() - stepLog.startedAt.toMillis()
      : null
    stepLog.outputRef = outputRef || null
    await stepLog.save()

    logger.info(
      { stepLogId, status: stepLog.status, durationMs: stepLog.durationMs },
      'Book import step completed'
    )

    return stepLog
  }

  /**
   * Mark a step as failed
   */
  async failStep(
    stepLogId: number,
    error: string,
    errorCode?: string,
    outputRef?: Record<string, unknown>
  ): Promise<BookProcessingStepLog> {
    const stepLog = await BookProcessingStepLog.findOrFail(stepLogId)
    stepLog.status = 'failed'
    stepLog.finishedAt = DateTime.now()
    stepLog.durationMs = stepLog.startedAt
      ? DateTime.now().toMillis() - stepLog.startedAt.toMillis()
      : null
    stepLog.errorMessage = error
    stepLog.errorCode = errorCode || null
    stepLog.outputRef = outputRef || null
    await stepLog.save()

    logger.error(
      { stepLogId, errorCode: stepLog.errorCode, durationMs: stepLog.durationMs },
      'Book import step failed'
    )

    return stepLog
  }

  /**
   * Mark a step as skipped (already completed in previous run)
   */
  async skipStep(stepLogId: number): Promise<BookProcessingStepLog> {
    const stepLog = await BookProcessingStepLog.findOrFail(stepLogId)
    stepLog.status = 'skipped'
    stepLog.finishedAt = DateTime.now()
    await stepLog.save()

    logger.info({ stepLogId, status: stepLog.status }, 'Book import step skipped')

    return stepLog
  }

  /**
   * Find a successful step log by bookId, stepKey, itemKey, and inputHash
   * Used for resuming interrupted jobs
   */
  async findSuccessfulStep(
    bookId: number,
    stepKey: string,
    itemKey?: string | null,
    inputHash?: string | null
  ): Promise<BookProcessingStepLog | null> {
    const query = BookProcessingStepLog.query()
      .where('bookId', bookId)
      .where('stepKey', stepKey)
      .where('status', 'success')

    if (itemKey !== undefined && itemKey !== null) {
      query.where('itemKey', itemKey)
    }

    if (inputHash !== undefined && inputHash !== null) {
      query.where('inputHash', inputHash)
    }

    return query.first()
  }

  /**
   * Get all successful steps for a book
   */
  async getSuccessfulSteps(bookId: number): Promise<BookProcessingStepLog[]> {
    return BookProcessingStepLog.query()
      .where('bookId', bookId)
      .where('status', 'success')
      .orderBy('startedAt', 'asc')
  }

  /**
   * Get all step logs for a run
   */
  async getStepsForRun(runLogId: number): Promise<BookProcessingStepLog[]> {
    return BookProcessingStepLog.query().where('runLogId', runLogId).orderBy('createdAt', 'asc')
  }
}
