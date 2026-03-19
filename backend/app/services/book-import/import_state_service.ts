import { DateTime } from 'luxon'
import { createHash } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import { BOOK_IMPORT_STEP } from '#constants'
import { BOOK_IMPORT_STEP_TRANSITIONS } from '#types/book_import_pipeline'
import type { BookImportPipelineStep } from '#types/book_import_pipeline'

@inject()
export class ImportStateService {
  static createImportCancelledError(bookId: number): Error {
    const error = new Error(`Import cancelled for book ${bookId}`)
    error.name = 'ImportCancelledError'
    return error
  }

  static isImportCancelledError(error: unknown): boolean {
    return error instanceof Error && error.name === 'ImportCancelledError'
  }

  private static isCancelledRun(runLog: BookProcessingRunLog): boolean {
    return runLog.status === 'failed' && runLog.errorCode === 'USER_ABORTED'
  }

  static canTransition(fromStep: string | null, toStep: string): boolean {
    if (toStep === BOOK_IMPORT_STEP.FAILED) {
      return fromStep !== BOOK_IMPORT_STEP.COMPLETED
    }

    if (fromStep === null) {
      return toStep === BOOK_IMPORT_STEP.PREPARE_IMPORT
    }

    if (fromStep === toStep) {
      return true
    }

    const next = BOOK_IMPORT_STEP_TRANSITIONS[fromStep as BookImportPipelineStep]
    return next === toStep
  }

  async startStep(
    runId: number,
    bookId: number,
    stepKey: string,
    progress: number,
    inputSummary?: Record<string, unknown>,
    itemKey?: string
  ): Promise<BookProcessingStepLog> {
    return await db.transaction(async (trx) => {
      const runLog = await BookProcessingRunLog.query({ client: trx })
        .where('id', runId)
        .firstOrFail()
      const book = await Book.query({ client: trx }).where('id', bookId).firstOrFail()

      if (book.status === 'cancelled' || ImportStateService.isCancelledRun(runLog)) {
        throw ImportStateService.createImportCancelledError(bookId)
      }

      if (!ImportStateService.canTransition(runLog.currentStep, stepKey)) {
        throw new Error(`Illegal step transition: ${runLog.currentStep ?? 'null'} -> ${stepKey}`)
      }

      const inputHash = inputSummary
        ? createHash('sha256').update(JSON.stringify(inputSummary)).digest('hex')
        : null

      const existingStep = await BookProcessingStepLog.query({ client: trx })
        .where('runLogId', runId)
        .where('stepKey', stepKey)
        .where('status', 'processing')
        .first()

      const stepLog =
        existingStep ||
        (await BookProcessingStepLog.create(
          {
            runLogId: runId,
            bookId,
            stepKey,
            itemKey: itemKey || null,
            inputHash,
            status: 'processing',
            startedAt: DateTime.now(),
          },
          { client: trx }
        ))

      runLog.currentStep = stepKey
      runLog.progress = progress
      runLog.status = 'processing'
      await runLog.save()

      book.status = 'processing'
      book.processingStep = stepKey
      book.processingProgress = progress
      book.processingError = null
      await book.save()

      return stepLog
    })
  }

  async completeStep(
    runId: number,
    stepLogId: number,
    bookId: number,
    stepKey: string,
    progress: number,
    outputRef?: Record<string, unknown>
  ): Promise<BookProcessingStepLog> {
    return await db.transaction(async (trx) => {
      const stepLog = await BookProcessingStepLog.query({ client: trx })
        .where('id', stepLogId)
        .firstOrFail()

      if (stepLog.status !== 'success') {
        stepLog.status = 'success'
        stepLog.finishedAt = DateTime.now()
        stepLog.durationMs = stepLog.startedAt
          ? DateTime.now().toMillis() - stepLog.startedAt.toMillis()
          : null
        stepLog.outputRef = outputRef || null
        await stepLog.save()
      }

      const runLog = await BookProcessingRunLog.query({ client: trx })
        .where('id', runId)
        .firstOrFail()
      const book = await Book.query({ client: trx }).where('id', bookId).firstOrFail()

      if (book.status === 'cancelled' || ImportStateService.isCancelledRun(runLog)) {
        throw ImportStateService.createImportCancelledError(bookId)
      }

      if (runLog.status !== 'processing' || book.status !== 'processing') {
        throw new Error(`Run ${runId} is no longer active`)
      }

      runLog.currentStep = stepKey
      runLog.progress = progress
      await runLog.save()

      book.status = 'processing'
      book.processingStep = stepKey
      book.processingProgress = progress
      book.processingError = null
      await book.save()

      return stepLog
    })
  }

  async failStep(
    runId: number,
    stepLogId: number,
    bookId: number,
    stepKey: string,
    errorMessage: string,
    errorCode?: string,
    outputRef?: Record<string, unknown>
  ): Promise<BookProcessingStepLog> {
    return await db.transaction(async (trx) => {
      const stepLog = await BookProcessingStepLog.query({ client: trx })
        .where('id', stepLogId)
        .firstOrFail()

      if (stepLog.status !== 'failed') {
        stepLog.status = 'failed'
        stepLog.finishedAt = DateTime.now()
        stepLog.durationMs = stepLog.startedAt
          ? DateTime.now().toMillis() - stepLog.startedAt.toMillis()
          : null
        stepLog.errorMessage = errorMessage
        stepLog.errorCode = errorCode || null
        stepLog.outputRef = outputRef || null
        await stepLog.save()
      }

      const runLog = await BookProcessingRunLog.query({ client: trx })
        .where('id', runId)
        .firstOrFail()
      runLog.currentStep = stepKey
      runLog.status = 'failed'
      runLog.finishedAt = runLog.finishedAt || DateTime.now()
      runLog.durationMs = runLog.startedAt
        ? DateTime.now().toMillis() - runLog.startedAt.toMillis()
        : null
      runLog.errorMessage = errorMessage
      runLog.errorCode = errorCode || null
      await runLog.save()

      const book = await Book.query({ client: trx }).where('id', bookId).firstOrFail()
      book.status = 'failed'
      book.processingStep = BOOK_IMPORT_STEP.FAILED
      book.processingProgress = 100
      book.processingError = errorMessage
      await book.save()

      return stepLog
    })
  }

  async markBookReady(bookId: number): Promise<Book> {
    const book = await Book.findOrFail(bookId)
    await book
      .merge({
        status: 'ready',
        processingStep: BOOK_IMPORT_STEP.COMPLETED,
        processingProgress: 100,
        processingError: null,
      })
      .save()
    return book
  }

  async markBookFailed(bookId: number, errorMessage: string): Promise<Book> {
    const book = await Book.findOrFail(bookId)
    await book
      .merge({
        status: 'failed',
        processingStep: BOOK_IMPORT_STEP.FAILED,
        processingProgress: 100,
        processingError: errorMessage,
      })
      .save()
    return book
  }

  async assertImportNotCancelled(runId: number, bookId: number): Promise<void> {
    const runLog = await BookProcessingRunLog.findOrFail(runId)
    const book = await Book.findOrFail(bookId)

    if (book.status === 'cancelled' || ImportStateService.isCancelledRun(runLog)) {
      throw ImportStateService.createImportCancelledError(bookId)
    }
  }
}
