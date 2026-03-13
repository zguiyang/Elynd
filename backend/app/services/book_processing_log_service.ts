import { DateTime } from 'luxon'
import BookProcessingRunLog, { type JobType } from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'

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
