import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Book from '#models/book'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import { createAuthenticatedUser } from '#tests/helpers/auth'
import { BOOK_IMPORT_STEP } from '#constants'
import { ImportStateService } from '#services/book-import/import_state_service'

const createProcessingBook = async (currentStep: string | null = null) => {
  const { user } = await createAuthenticatedUser({ isAdmin: true, emailPrefix: 'import-state' })
  const book = await Book.create({
    title: 'Import State Book',
    author: null,
    description: null,
    source: 'user_uploaded',
    difficultyLevel: 'L1',
    wordCount: 0,
    readingTime: 1,
    status: 'processing',
    processingStep: BOOK_IMPORT_STEP.PREPARE_IMPORT,
    processingProgress: 0,
    processingError: null,
    isPublished: false,
    contentHash: null,
    bookHash: null,
    rawFilePath: 'book/raw/test.txt',
    rawFileName: 'test.txt',
    rawFileExt: 'txt',
    rawFileSize: 128,
    rawFileHash: 'hash',
    audioStatus: 'pending',
    vocabularyStatus: 'pending',
    createdBy: user.id,
  })

  const run = await BookProcessingRunLog.create({
    bookId: book.id,
    jobType: 'import',
    status: 'processing',
    currentStep,
    progress: 0,
    startedAt: DateTime.now(),
  })

  return { user, book, run }
}

test.group('ImportStateService', () => {
  test('allows only deterministic step transitions', async ({ assert }) => {
    assert.isTrue(ImportStateService.canTransition(null, BOOK_IMPORT_STEP.PREPARE_IMPORT))
    assert.isTrue(
      ImportStateService.canTransition(
        BOOK_IMPORT_STEP.PREPARE_IMPORT,
        BOOK_IMPORT_STEP.SEMANTIC_CLEAN
      )
    )
    assert.isTrue(
      ImportStateService.canTransition(
        BOOK_IMPORT_STEP.SEMANTIC_CLEAN,
        BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT
      )
    )
    assert.isFalse(
      ImportStateService.canTransition(
        BOOK_IMPORT_STEP.PREPARE_IMPORT,
        BOOK_IMPORT_STEP.ENRICH_VOCABULARY
      )
    )
    assert.isFalse(
      ImportStateService.canTransition(BOOK_IMPORT_STEP.COMPLETED, BOOK_IMPORT_STEP.GENERATE_TTS)
    )
  })

  test('writes run step and book state atomically on start/complete', async ({
    assert,
    cleanup,
  }) => {
    const { user, book, run } = await createProcessingBook()
    cleanup(async () => {
      await BookProcessingStepLog.query().where('runLogId', run.id).delete()
      await run.delete()
      await book.delete()
      await user.delete()
    })

    const service = new ImportStateService()
    const step = await service.startStep(run.id, book.id, BOOK_IMPORT_STEP.PREPARE_IMPORT, 10, {
      source: 'upload',
    })

    await book.refresh()
    await run.refresh()

    assert.equal(step.stepKey, BOOK_IMPORT_STEP.PREPARE_IMPORT)
    assert.equal(run.currentStep, BOOK_IMPORT_STEP.PREPARE_IMPORT)
    assert.equal(run.progress, 10)
    assert.equal(book.processingStep, BOOK_IMPORT_STEP.PREPARE_IMPORT)
    assert.equal(book.processingProgress, 10)
    assert.equal(book.status, 'processing')

    await service.completeStep(run.id, step.id, book.id, BOOK_IMPORT_STEP.PREPARE_IMPORT, 20, {
      chapterCount: 12,
    })
    await run.refresh()
    await book.refresh()
    await step.refresh()

    assert.equal(step.status, 'success')
    assert.equal(run.progress, 20)
    assert.equal(book.processingProgress, 20)
  })

  test('supports idempotent completion and failure', async ({ assert, cleanup }) => {
    const { user, book, run } = await createProcessingBook(BOOK_IMPORT_STEP.PREPARE_IMPORT)
    cleanup(async () => {
      await BookProcessingStepLog.query().where('runLogId', run.id).delete()
      await run.delete()
      await book.delete()
      await user.delete()
    })

    const service = new ImportStateService()
    const step = await service.startStep(run.id, book.id, BOOK_IMPORT_STEP.SEMANTIC_CLEAN, 30)

    await service.completeStep(run.id, step.id, book.id, BOOK_IMPORT_STEP.SEMANTIC_CLEAN, 40)
    await service.completeStep(run.id, step.id, book.id, BOOK_IMPORT_STEP.SEMANTIC_CLEAN, 40)

    const completedStep = await BookProcessingStepLog.findOrFail(step.id)
    assert.equal(completedStep.status, 'success')

    const validateStep = await service.startStep(
      run.id,
      book.id,
      BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
      50
    )
    await service.completeStep(
      run.id,
      validateStep.id,
      book.id,
      BOOK_IMPORT_STEP.VALIDATE_CHAPTER_CONTENT,
      60
    )

    const failStep = await service.startStep(
      run.id,
      book.id,
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
      70
    )
    await service.failStep(
      run.id,
      failStep.id,
      book.id,
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
      'pipeline failed'
    )
    await service.failStep(
      run.id,
      failStep.id,
      book.id,
      BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED,
      'pipeline failed'
    )

    const failedStep = await BookProcessingStepLog.findOrFail(failStep.id)
    assert.equal(failedStep.status, 'failed')
    assert.equal(failedStep.errorMessage, 'pipeline failed')
  })

  test('marks terminal book states', async ({ assert, cleanup }) => {
    const { user, book, run } = await createProcessingBook()
    cleanup(async () => {
      await run.delete()
      await book.delete()
      await user.delete()
    })

    const service = new ImportStateService()

    await service.markBookReady(book.id)
    await book.refresh()
    assert.equal(book.status, 'ready')
    assert.equal(book.processingStep, BOOK_IMPORT_STEP.COMPLETED)
    assert.equal(book.processingProgress, 100)
    assert.isNull(book.processingError)

    await service.markBookFailed(book.id, 'fatal import error')
    await book.refresh()
    assert.equal(book.status, 'failed')
    assert.equal(book.processingStep, BOOK_IMPORT_STEP.FAILED)
    assert.equal(book.processingProgress, 100)
    assert.equal(book.processingError, 'fatal import error')
  })

  test('blocks startStep when import is manually cancelled', async ({ assert, cleanup }) => {
    const { user, book, run } = await createProcessingBook()
    cleanup(async () => {
      await BookProcessingStepLog.query().where('runLogId', run.id).delete()
      await run.delete()
      await book.delete()
      await user.delete()
    })

    await run.merge({ status: 'failed', errorCode: 'USER_ABORTED' }).save()
    const service = new ImportStateService()
    try {
      await service.startStep(run.id, book.id, BOOK_IMPORT_STEP.SEMANTIC_CLEAN, 20)
      assert.fail('Expected startStep to throw ImportCancelledError')
    } catch (error) {
      assert.equal((error as Error).name, 'ImportCancelledError')
      assert.include((error as Error).message, 'Import cancelled for book')
    }
  })

  test('blocks completeStep when import is manually cancelled', async ({ assert, cleanup }) => {
    const { user, book, run } = await createProcessingBook()
    cleanup(async () => {
      await BookProcessingStepLog.query().where('runLogId', run.id).delete()
      await run.delete()
      await book.delete()
      await user.delete()
    })

    const service = new ImportStateService()
    const step = await service.startStep(run.id, book.id, BOOK_IMPORT_STEP.PREPARE_IMPORT, 10)
    await run.merge({ status: 'failed', errorCode: 'USER_ABORTED' }).save()

    try {
      await service.completeStep(run.id, step.id, book.id, BOOK_IMPORT_STEP.PREPARE_IMPORT, 20)
      assert.fail('Expected completeStep to throw ImportCancelledError')
    } catch (error) {
      assert.equal((error as Error).name, 'ImportCancelledError')
      assert.include((error as Error).message, 'Import cancelled for book')
    }
  })
})
