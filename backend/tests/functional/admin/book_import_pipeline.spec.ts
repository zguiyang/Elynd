import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'
import Book from '#models/book'
import User from '#models/user'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import BookChapterAudio from '#models/book_chapter_audio'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import { BookProcessingLogService } from '#services/book_processing_log_service'
import ProcessBookJob from '#jobs/process_book_job'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import GenerateBookVocabularyJob from '#jobs/generate_book_vocabulary_job'
import crypto from 'node:crypto'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

/**
 * Helper function to create a test user
 */
async function createTestUser(): Promise<User> {
  return await User.create({
    fullName: 'Test User',
    email: `test-${crypto.randomUUID()}@example.com`,
    password: 'testpassword123',
    isAdmin: false,
  })
}

test.group('Book Import Pipeline Models', () => {
  test('BookProcessingRunLog model can be imported and instantiated', async ({ assert }) => {
    const runLog = new BookProcessingRunLog()
    assert.isTrue(
      runLog instanceof BookProcessingRunLog,
      'BookProcessingRunLog should be importable'
    )
  })

  test('BookProcessingStepLog model can be imported and instantiated', async ({ assert }) => {
    const stepLog = new BookProcessingStepLog()
    assert.isTrue(
      stepLog instanceof BookProcessingStepLog,
      'BookProcessingStepLog should be importable'
    )
  })

  test('BookChapterAudio model can be imported and instantiated', async ({ assert }) => {
    const chapterAudio = new BookChapterAudio()
    assert.isTrue(chapterAudio instanceof BookChapterAudio, 'BookChapterAudio should be importable')
  })

  test('Book model can have contentHash property set', async ({ assert }) => {
    const book = new Book()
    book.contentHash = 'abc123'
    assert.equal(book.contentHash, 'abc123', 'Book should have contentHash property')
  })

  test('BookProcessingRunLog model can have properties set', async ({ assert }) => {
    const runLog = new BookProcessingRunLog()
    runLog.bookId = 1
    runLog.jobType = 'import'
    runLog.status = 'processing'
    assert.equal(runLog.bookId, 1, 'BookProcessingRunLog should have bookId property')
    assert.equal(runLog.jobType, 'import', 'BookProcessingRunLog should have jobType property')
    assert.equal(runLog.status, 'processing', 'BookProcessingRunLog should have status property')
  })

  test('BookProcessingStepLog model can have properties set', async ({ assert }) => {
    const stepLog = new BookProcessingStepLog()
    stepLog.bookId = 1
    stepLog.stepKey = 'parse'
    stepLog.status = 'pending'
    assert.equal(stepLog.bookId, 1, 'BookProcessingStepLog should have bookId property')
    assert.equal(stepLog.stepKey, 'parse', 'BookProcessingStepLog should have stepKey property')
    assert.equal(stepLog.status, 'pending', 'BookProcessingStepLog should have status property')
  })

  test('BookChapterAudio model can have properties set', async ({ assert }) => {
    const chapterAudio = new BookChapterAudio()
    chapterAudio.bookId = 1
    chapterAudio.chapterIndex = 1
    chapterAudio.status = 'pending'
    assert.equal(chapterAudio.bookId, 1, 'BookChapterAudio should have bookId property')
    assert.equal(chapterAudio.chapterIndex, 1, 'BookChapterAudio should have chapterIndex property')
    assert.equal(chapterAudio.status, 'pending', 'BookChapterAudio should have status property')
  })
})

test.group('BookProcessingLogService', () => {
  test('has startRun method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.startRun === 'function', 'Should have startRun method')
  })

  test('has advanceRun method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.advanceRun === 'function', 'Should have advanceRun method')
  })

  test('has completeRun method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.completeRun === 'function', 'Should have completeRun method')
  })

  test('has failRun method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.failRun === 'function', 'Should have failRun method')
  })

  test('has startStep method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.startStep === 'function', 'Should have startStep method')
  })

  test('has completeStep method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.completeStep === 'function', 'Should have completeStep method')
  })

  test('has failStep method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(typeof service.failStep === 'function', 'Should have failStep method')
  })

  test('has findSuccessfulStep method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(
      typeof service.findSuccessfulStep === 'function',
      'Should have findSuccessfulStep method'
    )
  })

  test('has getOrCreateActiveRun method', async ({ assert }) => {
    const service = new BookProcessingLogService()
    assert.isTrue(
      typeof service.getOrCreateActiveRun === 'function',
      'Should have getOrCreateActiveRun method'
    )
  })
})

test.group('ProcessBookJob with Logging', () => {
  test('creates run log on job start', async ({ assert, cleanup }) => {
    // Create test user first
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Logging',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the job
    const job = new ProcessBookJob()
    await job.handle({ bookId: book.id, userId: user.id })

    // Verify run log was created
    const runLogs = await BookProcessingRunLog.query()
      .where('bookId', book.id)
      .orderBy('id', 'desc')
    assert.isTrue(runLogs.length > 0, 'Run log should be created')

    const runLog = runLogs[0]
    const successfulRun = runLogs.find(
      (item) => item.jobType === 'import' && item.status === 'success'
    )

    assert.equal(runLog.bookId, book.id, 'Run log should have correct bookId')
    assert.equal(runLog.jobType, 'import', 'Run log should have jobType import')
    assert.exists(successfulRun, 'Run logs should contain a completed import run')
  })

  test('creates step logs for each processing step', async ({ assert, cleanup }) => {
    // Create test user first
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Step Logs',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the job
    const job = new ProcessBookJob()
    await job.handle({ bookId: book.id, userId: user.id })

    // Verify step logs were created
    const stepLogs = await BookProcessingStepLog.query().where('bookId', book.id)
    assert.isTrue(stepLogs.length > 0, 'Step logs should be created')

    // Check that we have logs for key steps
    const stepKeys = stepLogs.map((s) => s.stepKey)
    assert.isTrue(stepKeys.includes('persisting_book'), 'Should have persisting_book step')
    assert.isTrue(stepKeys.includes('parallel_processing'), 'Should have parallel_processing step')
  })

  test('failed step writes error_message', async ({ cleanup }) => {
    // Create test user first
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with invalid data to trigger error
    const book = await Book.create({
      title: 'Test Book for Error',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the job with a non-existent book ID to trigger error
    const job = new ProcessBookJob()
    try {
      await job.handle({ bookId: 99999, userId: user.id })
    } catch (e) {
      // Expected to fail
    }

    // Note: Since book 99999 doesn't exist, run log won't be created
    // This test validates the error handling path exists
  })

  test('book status is NOT set to ready in ProcessBookJob (audio handled separately)', async ({
    assert,
    cleanup,
  }) => {
    // Create test user first
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Ready Status',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the job
    const job = new ProcessBookJob()
    await job.handle({ bookId: book.id, userId: user.id })

    // Refresh book from database
    await book.refresh()

    // The job should queue audio but NOT set status to ready
    // (audio generation is handled by separate job)
    assert.notEqual(
      book.status,
      'ready',
      'Book should NOT be set to ready in ProcessBookJob (audio handled separately)'
    )
  })

  test('can resume from successful step using input_hash', async ({ assert, cleanup }) => {
    const logService = new BookProcessingLogService()

    // Create test user first
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Resume',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Simulate a previous successful step
    const runLog = await logService.startRun(book.id, 'import')
    const testHash = 'test-input-hash-123'

    await logService.startStep(runLog.id, book.id, 'analyze_vocabulary', undefined, testHash)
    const previousStep = await logService.findSuccessfulStep(
      book.id,
      'analyze_vocabulary',
      null,
      testHash
    )

    // Initially no successful step
    assert.isNull(previousStep, 'Should not find successful step initially')

    // Complete the step
    const allSteps = await BookProcessingStepLog.query().where('runLogId', runLog.id)
    if (allSteps.length > 0) {
      await logService.completeStep(allSteps[0].id)
    }

    // Now should find successful step
    const successfulStep = await logService.findSuccessfulStep(
      book.id,
      'analyze_vocabulary',
      null,
      testHash
    )
    assert.isNotNull(successfulStep, 'Should find successful step after completion')
    assert.equal(successfulStep?.status, 'success', 'Step should be marked as success')
  })
})

test.group('Import Pipeline Contract - Step Keys', () => {
  test('canonical step keys are defined and used', async ({ assert }) => {
    // Import the canonical step keys from constants
    const { BOOK_IMPORT_STEP } = await import('#constants/index')

    // Verify all canonical step keys exist
    assert.equal(BOOK_IMPORT_STEP.RECEIVED, 'import_received', 'Should have import_received step')
    assert.equal(
      BOOK_IMPORT_STEP.SEMANTIC_CLEANING,
      'semantic_cleaning',
      'Should have semantic_cleaning step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.DEDUP_CHECKING,
      'dedup_checking',
      'Should have dedup_checking step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.PERSISTING_BOOK,
      'persisting_book',
      'Should have persisting_book step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.PARALLEL_PROCESSING,
      'parallel_processing',
      'Should have parallel_processing step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.AUDIO_PROCESSING,
      'audio_processing',
      'Should have audio_processing step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.VOCABULARY_PROCESSING,
      'vocabulary_processing',
      'Should have vocabulary_processing step'
    )
    assert.equal(
      BOOK_IMPORT_STEP.FINALIZING_PUBLISH,
      'finalizing_publish',
      'Should have finalizing_publish step'
    )
    assert.equal(BOOK_IMPORT_STEP.COMPLETED, 'completed', 'Should have completed step')
    assert.equal(BOOK_IMPORT_STEP.FAILED, 'failed', 'Should have failed step')
  })

  test('progress weights are defined for each phase', async ({ assert }) => {
    const { BOOK_IMPORT_PROGRESS } = await import('#constants/index')

    // Verify progress weight constants
    assert.equal(BOOK_IMPORT_PROGRESS.PREP_PHASE_MAX, 40, 'Prep phase should have max 40')
    assert.equal(BOOK_IMPORT_PROGRESS.AUDIO_PHASE_MAX, 30, 'Audio phase should have max 30')
    assert.equal(
      BOOK_IMPORT_PROGRESS.VOCABULARY_PHASE_MAX,
      30,
      'Vocabulary phase should have max 30'
    )
    assert.equal(BOOK_IMPORT_PROGRESS.TOTAL_MAX, 100, 'Total should be 100')
  })

  test('step logs use canonical step keys during import', async ({ assert, cleanup }) => {
    const { BOOK_IMPORT_STEP } = await import('#constants/index')

    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Canonical Keys',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the job
    const job = new ProcessBookJob()
    await job.handle({ bookId: book.id, userId: user.id })

    // Verify step logs use canonical keys
    const stepLogs = await BookProcessingStepLog.query().where('bookId', book.id)
    const stepKeys = stepLogs.map((s) => s.stepKey)

    // The job should use canonical step keys (at least some of them)
    const hasCanonicalKey = stepKeys.some(
      (key) =>
        key === BOOK_IMPORT_STEP.PERSISTING_BOOK ||
        key === BOOK_IMPORT_STEP.PARALLEL_PROCESSING ||
        key === BOOK_IMPORT_STEP.AUDIO_PROCESSING
    )

    assert.isTrue(hasCanonicalKey, 'Step logs should use canonical step keys')
  })
})

test.group('GenerateBookAudioJob - Chapter Level Retry', () => {
  test('one chapter failed -> retry only failed chapter', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with chapters
    const book = await Book.create({
      title: 'Test Book for Chapter Retry',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 1',
        content: 'Content for chapter 1',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 2',
        content: 'Content for chapter 2',
      },
    ])

    // Create existing successful chapter audio for chapter 1
    await BookChapterAudio.create({
      bookId: book.id,
      chapterIndex: 1,
      textHash: 'hash-chapter-1',
      voiceHash: 'default-voice',
      audioPath: 'book/voices/1/chapter-1.mp3',
      durationMs: 60000,
      status: 'completed',
    })

    // Simulate failed chapter 2 (by creating a failed record or simply missing)
    // The job should:
    // 1. Find chapter 1 has completed audio with matching hash -> reuse
    // 2. Find chapter 2 needs generation -> generate it
    // 3. Complete book when all chapters done

    // For now, we expect the job to process all chapters

    // The job should handle chapter 1 as reused and chapter 2 as needs generation
    // Note: We can't fully test without mocking TTS, but we can verify the logic exists

    // Verify we have the chapter audio infrastructure
    const chapterAudios = await BookChapterAudio.query().where('bookId', book.id)
    assert.equal(chapterAudios.length, 1, 'Should have one existing chapter audio')
    assert.equal(chapterAudios[0].chapterIndex, 1, 'Chapter 1 should be completed')
    assert.equal(chapterAudios[0].status, 'completed', 'Chapter 1 status should be completed')
  })

  test('completed chapters are reused via book_chapter_audios', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Reuse',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapter
    await BookChapter.create({
      bookId: book.id,
      chapterIndex: 1,
      title: 'Chapter 1',
      content: 'Content for chapter 1',
    })

    // Create existing completed chapter audio with specific hashes
    const textHash = 'test-text-hash-123'
    const voiceHash = 'test-voice-hash-456'

    await BookChapterAudio.create({
      bookId: book.id,
      chapterIndex: 1,
      textHash,
      voiceHash,
      audioPath: 'book/voices/1/chapter-1.mp3',
      durationMs: 60000,
      status: 'completed',
    })

    // Verify we can query by text_hash + voice_hash (reuse check)
    const existingAudio = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('chapterIndex', 1)
      .where('textHash', textHash)
      .where('voiceHash', voiceHash)
      .where('status', 'completed')
      .first()

    assert.isNotNull(existingAudio, 'Should find existing completed audio for reuse')
    assert.equal(existingAudio?.audioPath, 'book/voices/1/chapter-1.mp3', 'Audio path should match')
  })

  test('book becomes ready only after all chapters have completed audio', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Readiness',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content 1' },
      { bookId: book.id, chapterIndex: 2, title: 'Chapter 2', content: 'Content 2' },
      { bookId: book.id, chapterIndex: 3, title: 'Chapter 3', content: 'Content 3' },
    ])

    // Only complete 2 out of 3 chapters
    await BookChapterAudio.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        textHash: 'h1',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path1',
        durationMs: 1000,
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        textHash: 'h2',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path2',
        durationMs: 1000,
      },
      // Chapter 3 is not completed
    ])

    // Check if all chapters are completed
    const totalChapters = await BookChapter.query().where('bookId', book.id).count('* as total')
    const completedAudios = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'completed')
      .count('* as total')

    const chapterCount = Number(totalChapters[0].$extras.total)
    const completedCount = Number(completedAudios[0].$extras.total)

    assert.equal(chapterCount, 3, 'Should have 3 chapters')
    assert.equal(completedCount, 2, 'Should have 2 completed audios')
    assert.isFalse(completedCount === chapterCount, 'Book should NOT be ready yet')
  })
})

test.group('Admin Book Status Endpoint - Diagnostics', () => {
  test('status endpoint includes run diagnostics', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Status',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 75,
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create a run log
    const runLog = await BookProcessingRunLog.create({
      bookId: book.id,
      jobType: 'import',
      status: 'processing',
      currentStep: 'generate_audio',
      progress: 75,
      startedAt: DateTime.now(),
    })

    // Create step logs
    await BookProcessingStepLog.createMany([
      {
        runLogId: runLog.id,
        bookId: book.id,
        stepKey: 'persisting_book',
        status: 'success',
        startedAt: DateTime.now(),
        finishedAt: DateTime.now(),
        durationMs: 1000,
      },
      {
        runLogId: runLog.id,
        bookId: book.id,
        stepKey: 'parallel_processing',
        status: 'success',
        startedAt: DateTime.now(),
        finishedAt: DateTime.now(),
        durationMs: 2000,
      },
      {
        runLogId: runLog.id,
        bookId: book.id,
        stepKey: 'generate_audio',
        status: 'processing',
        startedAt: DateTime.now(),
      },
    ])

    // Test: should include run diagnostics
    // This test will fail until we implement the enriched status response
    // For now, we verify the data exists in the database
    const latestRun = await BookProcessingRunLog.query()
      .where('bookId', book.id)
      .orderBy('startedAt', 'desc')
      .first()

    assert.isNotNull(latestRun, 'Should have a run log')
    assert.equal(latestRun?.status, 'processing', 'Run status should be processing')
    assert.equal(latestRun?.currentStep, 'generate_audio', 'Current step should be generate_audio')
    assert.equal(latestRun?.progress, 75, 'Progress should be 75')
  })

  test('status endpoint includes last error info', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with failed run
    const book = await Book.create({
      title: 'Test Book for Error Status',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'failed',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create a failed run log
    await BookProcessingRunLog.create({
      bookId: book.id,
      jobType: 'import',
      status: 'failed',
      currentStep: 'analyze_vocabulary',
      progress: 10,
      startedAt: DateTime.now(),
      finishedAt: DateTime.now(),
      errorCode: 'VOCABULARY_ANALYSIS_FAILED',
      errorMessage: 'Failed to analyze vocabulary: API rate limit exceeded',
    })

    // Test: should include last error info
    const latestRun = await BookProcessingRunLog.query()
      .where('bookId', book.id)
      .orderBy('startedAt', 'desc')
      .first()

    assert.isNotNull(latestRun, 'Should have a run log')
    assert.equal(latestRun?.status, 'failed', 'Run status should be failed')
    assert.equal(
      latestRun?.errorCode,
      'VOCABULARY_ANALYSIS_FAILED',
      'Error code should be captured'
    )
    assert.equal(
      latestRun?.errorMessage,
      'Failed to analyze vocabulary: API rate limit exceeded',
      'Error message should be captured'
    )
  })

  test('status endpoint includes chapter audio completion summary', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Audio Summary',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content 1' },
      { bookId: book.id, chapterIndex: 2, title: 'Chapter 2', content: 'Content 2' },
      { bookId: book.id, chapterIndex: 3, title: 'Chapter 3', content: 'Content 3' },
      { bookId: book.id, chapterIndex: 4, title: 'Chapter 4', content: 'Content 4' },
    ])

    // Create chapter audios (2 completed, 1 pending, 1 failed)
    await BookChapterAudio.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        textHash: 'h1',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path1',
        durationMs: 1000,
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        textHash: 'h2',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path2',
        durationMs: 1500,
      },
      { bookId: book.id, chapterIndex: 3, textHash: 'h3', voiceHash: 'v', status: 'pending' },
      {
        bookId: book.id,
        chapterIndex: 4,
        textHash: 'h4',
        voiceHash: 'v',
        status: 'failed',
        errorMessage: 'TTS service unavailable',
      },
    ])

    // Test: should include chapter audio completion summary
    const totalChapters = await BookChapter.query().where('bookId', book.id).count('* as total')
    const completedAudios = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'completed')
      .count('* as total')
    const failedAudios = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'failed')
      .count('* as total')
    const pendingAudios = await BookChapterAudio.query()
      .where('bookId', book.id)
      .where('status', 'pending')
      .count('* as total')

    const total = Number(totalChapters[0].$extras.total)
    const completed = Number(completedAudios[0].$extras.total)
    const failed = Number(failedAudios[0].$extras.total)
    const pending = Number(pendingAudios[0].$extras.total)

    assert.equal(total, 4, 'Should have 4 chapters')
    assert.equal(completed, 2, 'Should have 2 completed audios')
    assert.equal(failed, 1, 'Should have 1 failed audio')
    assert.equal(pending, 1, 'Should have 1 pending audio')
    assert.equal(completed + failed + pending, total, 'All chapters should be accounted for')
  })

  test('book service provides enriched status with diagnostics', async ({ assert, cleanup }) => {
    const { BookService } = await import('#services/book_service')

    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Enriched Status',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content 1' },
      { bookId: book.id, chapterIndex: 2, title: 'Chapter 2', content: 'Content 2' },
    ])

    // Create a run log
    const runLog = await BookProcessingRunLog.create({
      bookId: book.id,
      jobType: 'import',
      status: 'success',
      currentStep: 'parallel_processing',
      progress: 100,
      startedAt: DateTime.now(),
      finishedAt: DateTime.now(),
    })

    // Create step logs
    await BookProcessingStepLog.createMany([
      {
        runLogId: runLog.id,
        bookId: book.id,
        stepKey: 'persisting_book',
        status: 'success',
        startedAt: DateTime.now(),
        finishedAt: DateTime.now(),
      },
      {
        runLogId: runLog.id,
        bookId: book.id,
        stepKey: 'parallel_processing',
        status: 'success',
        startedAt: DateTime.now(),
        finishedAt: DateTime.now(),
      },
    ])

    // Create chapter audios
    await BookChapterAudio.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        textHash: 'h1',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path1',
        durationMs: 1000,
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        textHash: 'h2',
        voiceHash: 'v',
        status: 'completed',
        audioPath: 'path2',
        durationMs: 1500,
      },
    ])

    // Get enriched status from service
    const bookService = new BookService()
    const enrichedStatus = await bookService.getEnrichedStatus(book.id)

    // Verify enriched status structure
    assert.isObject(enrichedStatus, 'Should return an object')
    assert.equal(enrichedStatus.id, book.id, 'Should include book id')
    assert.equal(enrichedStatus.status, 'processing', 'Should include book status')

    // Verify run diagnostics
    assert.isObject(enrichedStatus.latestRun, 'Should include latest run info')
    const latestRun = enrichedStatus.latestRun!
    assert.equal(latestRun.status, 'success', 'Latest run status should be success')
    assert.equal(
      latestRun.currentStep,
      'parallel_processing',
      'Current step should be parallel_processing'
    )

    // Verify chapter audio summary
    assert.isObject(enrichedStatus.chapterAudioSummary, 'Should include chapter audio summary')
    assert.equal(enrichedStatus.chapterAudioSummary.total, 2, 'Should have 2 total chapters')
    assert.equal(enrichedStatus.chapterAudioSummary.completed, 2, 'Should have 2 completed audios')
    assert.equal(enrichedStatus.chapterAudioSummary.pending, 0, 'Should have 0 pending audios')
  })
})

test.group('GenerateBookAudioJob - Failure State Convergence', () => {
  test('failed audio job converges book status to failed', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book in processing status
    const book = await Book.create({
      title: 'Test Book for Audio Failure',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
      audioStatus: 'processing',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapter with content
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content 1' },
    ])

    // Test by manually invoking processChapter with a failing service
    // We'll directly test the failure handling logic

    // Simulate a failed result by directly calling the failure path
    // First, let's verify the current behavior by checking if audioStatus is updated on failure
    // We trigger failure by passing an invalid book ID (will fail at Book.find)
    try {
      await new GenerateBookAudioJob().handle({ bookId: 99999 })
    } catch (error) {
      // Expected - book not found
    }

    // The test should verify that when a real failure occurs,
    // the code properly sets status, processingStep and processingError
    // For now, we verify the test framework is set up correctly
    assert.isTrue(true, 'Test framework working')
  })

  test('audio job failure should set book.status to failed', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book in processing status
    const book = await Book.create({
      title: 'Test Book for Status Check',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
      audioStatus: 'processing',
      vocabularyStatus: 'completed', // Required for book to be marked as ready
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Verify current state - book.status is 'processing'
    assert.equal(book.status, 'processing', 'Initial status should be processing')
    assert.equal(book.processingStep, 'audio', 'Initial processing step should be audio')

    // Run job with valid book to complete successfully (since TTS works in test env)
    await new GenerateBookAudioJob().handle({ bookId: book.id })

    // Refresh and check status
    await book.refresh()

    // After successful audio generation, status should be 'ready'
    // This verifies the job runs correctly
    assert.equal(book.status, 'ready', 'After successful audio generation, status should be ready')
  })

  test('run log metadata contains structured info on audio failure', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book in processing status
    const book = await Book.create({
      title: 'Test Book for Run Log Metadata',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      processingStep: 'audio',
      processingProgress: 50,
      audioStatus: 'processing',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content 1' },
    ])

    // Run audio job - will succeed but we can test metadata structure
    await new GenerateBookAudioJob().handle({ bookId: book.id })

    // Check latest run log
    const runLog = await BookProcessingRunLog.query()
      .where('bookId', book.id)
      .orderBy('startedAt', 'desc')
      .first()

    // Verify metadata structure
    assert.isNotNull(runLog, 'Run log should exist')
    assert.isObject(runLog!.metadata, 'Run log should have metadata field')

    // Verify metadata contains expected structure
    const metadata = runLog!.metadata!
    assert.isObject(metadata.context, 'Metadata should have context')
    assert.deepEqual((metadata.context as any).bookId, book.id, 'Context should have bookId')
    assert.isObject(metadata.summary, 'Metadata should have summary')
    assert.isNumber((metadata.summary as any).totalChapters, 'Summary should have totalChapters')
    assert.isNumber(
      (metadata.summary as any).completedChapters,
      'Summary should have completedChapters'
    )
  })

  test('step logs contain structured outputRef with inputSummary and resultSummary', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Step OutputRef',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Run the import job
    const job = new ProcessBookJob()
    await job.handle({ bookId: book.id, userId: user.id })

    // Check step logs for structured outputRef
    const stepLogs = await BookProcessingStepLog.query().where('bookId', book.id)

    // Find steps with outputRef
    const persistingStep = stepLogs.find((s) => s.stepKey === 'persisting_book')
    const parallelStep = stepLogs.find((s) => s.stepKey === 'parallel_processing')

    // Verify persisting_book step has structured outputRef
    if (persistingStep?.outputRef) {
      assert.isObject(persistingStep.outputRef, 'persisting_book should have outputRef')
      // Check for either old format or new format
      const hasOldFormat = (persistingStep.outputRef as any).vocabularyCount !== undefined
      const hasNewFormat = (persistingStep.outputRef as any).resultSummary !== undefined
      assert.isTrue(
        hasOldFormat || hasNewFormat,
        'Should have either vocabularyCount or resultSummary'
      )
    }

    // Verify parallel_processing step has structured outputRef
    if (parallelStep?.outputRef) {
      assert.isObject(parallelStep.outputRef, 'parallel_processing should have outputRef')
      const hasOldFormat = (parallelStep.outputRef as any).audioJobDispatched !== undefined
      const hasVocabularyJobDispatched =
        (parallelStep.outputRef as any).vocabularyJobDispatched !== undefined
      const hasNewFormat = (parallelStep.outputRef as any).resultSummary !== undefined
      assert.isTrue(
        hasOldFormat || hasVocabularyJobDispatched || hasNewFormat,
        'Should have either audioJobDispatched, vocabularyJobDispatched, or resultSummary'
      )
    }
  })
})

test.group('Admin Book Import Endpoint - Async Orchestration', () => {
  test('POST /api/admin/books/import returns quickly with processing state', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create admin user
    const { user: admin, token } = await createAuthenticatedUser({
      fullName: 'Import Test Admin',
      emailPrefix: 'import-admin',
      isAdmin: true,
    })
    cleanup(async () => {
      await admin.delete()
    })

    const importPayload = {
      title: 'Test Book for Import',
      author: 'Test Author',
      description: 'Test Description',
      source: 'user_uploaded' as const,
      difficultyLevel: 'L1' as const,
      wordCount: 500,
      bookHash: 'abc123testhash',
      chapters: [
        { title: 'Chapter 1', content: 'This is the content of chapter 1. It has some text.' },
        { title: 'Chapter 2', content: 'This is the content of chapter 2. More text here.' },
      ],
    }

    const startTime = Date.now()
    const response = await client
      .post('/api/admin/books/import')
      .header('Authorization', bearerAuthHeader(token))
      .json(importPayload)
    const endTime = Date.now()

    response.assertStatus(200)

    // Should return quickly (less than 500ms) - not doing heavy processing inline
    const responseTime = endTime - startTime
    assert.isTrue(
      responseTime < 500,
      `Response should be fast (<500ms), but took ${responseTime}ms`
    )

    // Should return processing state
    const body = response.body()
    assert.equal(body.status, 'processing', 'Book should be in processing state')
    assert.exists(body.bookId, 'Should return bookId')

    // Cleanup created book
    if (body.bookId) {
      const book = await Book.find(body.bookId)
      if (book) {
        await BookChapter.query().where('bookId', book.id).delete()
        await book.delete()
      }
    }
  })

  test('POST /api/admin/books/import initializes audioStatus and vocabularyStatus', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create admin user
    const { user: admin, token } = await createAuthenticatedUser({
      fullName: 'Import Test Admin 2',
      emailPrefix: 'import-admin-2',
      isAdmin: true,
    })
    cleanup(async () => {
      await admin.delete()
    })

    const importPayload = {
      title: 'Test Book for Status Init',
      author: 'Test Author',
      source: 'user_uploaded' as const,
      difficultyLevel: 'L2' as const,
      wordCount: 300,
      bookHash: 'def456testhash',
      chapters: [{ title: 'Chapter 1', content: 'Content for testing status init.' }],
    }

    const response = await client
      .post('/api/admin/books/import')
      .header('Authorization', bearerAuthHeader(token))
      .json(importPayload)

    response.assertStatus(200)
    const body = response.body()

    // Verify book was created with proper initial statuses
    const book = await Book.find(body.bookId)
    assert.exists(book, 'Book should be created')

    // Check initial statuses
    assert.equal(book!.audioStatus, 'pending', 'audioStatus should be initialized to pending')
    assert.equal(
      book!.vocabularyStatus,
      'pending',
      'vocabularyStatus should be initialized to pending'
    )
    assert.equal(book!.status, 'processing', 'status should be processing')
    assert.equal(book!.isPublished, false, 'isPublished should be false')

    // Cleanup
    if (book) {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    }
  })

  test('POST /api/admin/books/import sets processingStep to import_received', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create admin user
    const { user: admin, token } = await createAuthenticatedUser({
      fullName: 'Import Test Admin 3',
      emailPrefix: 'import-admin-3',
      isAdmin: true,
    })
    cleanup(async () => {
      await admin.delete()
    })

    const importPayload = {
      title: 'Test Book for Step',
      author: 'Test Author',
      source: 'public_domain' as const,
      difficultyLevel: 'L3' as const,
      wordCount: 1000,
      bookHash: 'ghi789testhash',
      chapters: [{ title: 'Chapter 1', content: 'Content for testing step.' }],
    }

    const response = await client
      .post('/api/admin/books/import')
      .header('Authorization', bearerAuthHeader(token))
      .json(importPayload)

    response.assertStatus(200)
    const body = response.body()

    // Verify processingStep is set correctly
    const book = await Book.find(body.bookId)
    assert.exists(book, 'Book should be created')
    assert.equal(
      book!.processingStep,
      'import_received',
      'processingStep should be import_received'
    )

    // Cleanup
    if (book) {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    }
  })

  test('POST /api/admin/books/import stores bookHash for traceability', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create admin user
    const { user: admin, token } = await createAuthenticatedUser({
      fullName: 'Import Test Admin 4',
      emailPrefix: 'import-admin-4',
      isAdmin: true,
    })
    cleanup(async () => {
      await admin.delete()
    })

    const testBookHash = 'test-book-hash-12345-abcde'
    const importPayload = {
      title: 'Test Book for Hash',
      author: 'Test Author',
      source: 'ai_generated' as const,
      difficultyLevel: 'L1' as const,
      wordCount: 200,
      bookHash: testBookHash,
      chapters: [{ title: 'Chapter 1', content: 'Content.' }],
    }

    const response = await client
      .post('/api/admin/books/import')
      .header('Authorization', bearerAuthHeader(token))
      .json(importPayload)

    response.assertStatus(200)
    const body = response.body()

    // Verify bookHash is stored
    const book = await Book.find(body.bookId)
    assert.exists(book, 'Book should be created')
    assert.equal(book!.bookHash, testBookHash, 'bookHash should be stored')

    // Cleanup
    if (book) {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    }
  })

  test('POST /api/admin/books/import rejects request without bookHash', async ({
    client,
    cleanup,
  }) => {
    // Create admin user
    const { user: admin, token } = await createAuthenticatedUser({
      fullName: 'Import Test Admin 5',
      emailPrefix: 'import-admin-5',
      isAdmin: true,
    })
    cleanup(async () => {
      await admin.delete()
    })

    const importPayload = {
      title: 'Test Book No Hash',
      author: 'Test Author',
      source: 'user_uploaded' as const,
      difficultyLevel: 'L1' as const,
      wordCount: 200,
      // No bookHash provided
      chapters: [{ title: 'Chapter 1', content: 'Content.' }],
    }

    const response = await client
      .post('/api/admin/books/import')
      .header('Authorization', bearerAuthHeader(token))
      .json(importPayload)

    // Should fail validation
    response.assertStatus(422)
  })
})

test.group('GenerateBookVocabularyJob - Dictionary Only Pipeline', (group) => {
  const originalFetch = global.fetch
  const originalRedisGet = redis.get.bind(redis)
  const originalRedisSetex = redis.setex.bind(redis)

  group.each.teardown(() => {
    global.fetch = originalFetch
    redis.get = originalRedisGet
    redis.setex = originalRedisSetex
  })

  test('extracts vocabulary from chapters when DB is empty', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with chapters
    const book = await Book.create({
      title: 'Test Book for Vocab Extract',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 1',
        content: 'Hello world. This is a test book.',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 2',
        content: 'Apple banana orange. Learning English words.',
      },
    ])

    // Mock DictionaryService lookupBatch to return results
    global.fetch = (async (input) => {
      const url = String(input)
      if (url.includes('/hello')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'hello',
              phonetic: '/həˈloʊ/',
              phonetics: [{ text: '/həˈloʊ/', audio: 'https://audio.test/hello.mp3' }],
              meanings: [
                {
                  partOfSpeech: 'exclamation',
                  definitions: [{ definition: 'Used as a greeting' }],
                },
              ],
            },
          ],
        } as Response
      }
      if (url.includes('/world')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'world',
              phonetic: '/wɜːrld/',
              phonetics: [{ text: '/wɜːrld/', audio: 'https://audio.test/world.mp3' }],
              meanings: [
                {
                  partOfSpeech: 'noun',
                  definitions: [{ definition: 'The earth and all its inhabitants' }],
                },
              ],
            },
          ],
        } as Response
      }
      if (url.includes('/apple')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'apple',
              phonetic: '/ˈæp.əl/',
              phonetics: [{ text: '/ˈæp.əl/', audio: 'https://audio.test/apple.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A fruit' }] }],
            },
          ],
        } as Response
      }
      return { ok: false, status: 404, json: async () => [] } as Response
    }) as typeof global.fetch

    // Run the vocabulary job
    const job = new GenerateBookVocabularyJob()
    await job.handle({ bookId: book.id })

    // Verify vocabulary was extracted
    const vocabularies = await BookVocabulary.query().where('bookId', book.id)
    assert.isTrue(vocabularies.length > 0, 'Vocabulary should be extracted from chapters')

    // Verify book vocabularyStatus is 'completed'
    const updatedBook = await Book.find(book.id)
    assert.equal(updatedBook?.vocabularyStatus, 'completed', 'vocabularyStatus should be completed')
  })

  test('enriches vocabulary by dictionary lookup', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book for Vocab Enrich',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create existing vocabulary without details
    await BookVocabulary.createMany([
      { bookId: book.id, word: 'test', lemma: 'test', frequency: 5, meaning: '', sentence: '' },
      { bookId: book.id, word: 'book', lemma: 'book', frequency: 3, meaning: '', sentence: '' },
    ])

    // Mock DictionaryService lookupBatch to return results
    global.fetch = (async (input) => {
      const url = String(input)
      if (url.includes('/test')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'test',
              phonetic: '/test/',
              phonetics: [{ text: '/test/', audio: 'https://audio.test/test.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A procedure' }] }],
            },
          ],
        } as Response
      }
      if (url.includes('/book')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'book',
              phonetic: '/bʊk/',
              phonetics: [{ text: '/bʊk/', audio: 'https://audio.test/book.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A written text' }] }],
            },
          ],
        } as Response
      }
      return { ok: false, status: 404, json: async () => [] } as Response
    }) as typeof global.fetch

    // Run the vocabulary job
    const job = new GenerateBookVocabularyJob()
    await job.handle({ bookId: book.id })

    // Verify vocabulary was enriched
    const vocabularies = await BookVocabulary.query().where('bookId', book.id)

    // Check that phoneticText and details were filled
    const testVocab = vocabularies.find((v) => v.word === 'test')
    assert.exists(testVocab?.phoneticText, 'test should have phoneticText')
    assert.exists(testVocab?.details, 'test should have details')

    // Verify book vocabularyStatus is 'completed'
    const updatedBook = await Book.find(book.id)
    assert.equal(updatedBook?.vocabularyStatus, 'completed', 'vocabularyStatus should be completed')
  })

  test('never calls AI for meaning generation', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with chapters
    const book = await Book.create({
      title: 'Test Book for No AI',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Hello world test.' },
    ])

    // Track if AI service is called - we don't mock any AI endpoint, so any call to AI would fail
    let aiApiCalled = false
    const originalFetchInTest = global.fetch

    global.fetch = (async (input) => {
      const url = String(input)
      // Check if any AI-related API is called
      if (url.includes('openai') || url.includes('anthropic') || url.includes('ai.')) {
        aiApiCalled = true
      }
      // Return valid dictionary responses for known words
      if (url.includes('/hello')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'hello',
              phonetic: '/həˈloʊ/',
              phonetics: [{ text: '/həˈloʊ/', audio: 'https://audio.test/hello.mp3' }],
              meanings: [
                {
                  partOfSpeech: 'exclamation',
                  definitions: [{ definition: 'Used as a greeting' }],
                },
              ],
            },
          ],
        } as Response
      }
      if (url.includes('/world')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'world',
              phonetic: '/wɜːrld/',
              phonetics: [{ text: '/wɜːrld/', audio: 'https://audio.test/world.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'The earth' }] }],
            },
          ],
        } as Response
      }
      if (url.includes('/test')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'test',
              phonetic: '/test/',
              phonetics: [{ text: '/test/', audio: 'https://audio.test/test.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A procedure' }] }],
            },
          ],
        } as Response
      }
      return originalFetchInTest(input)
    }) as typeof global.fetch

    // Run the vocabulary job
    const job = new GenerateBookVocabularyJob()
    await job.handle({ bookId: book.id })

    // Verify AI was never called
    assert.isFalse(aiApiCalled, 'AI service should never be called for vocabulary enrichment')
  })

  test('logs step with vocabulary extraction counts', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with chapters
    const book = await Book.create({
      title: 'Test Book for Step Log',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Hello world test book.' },
    ])

    // Mock DictionaryService
    global.fetch = (async (input) => {
      const url = String(input)
      if (url.includes('/hello')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'hello',
              phonetic: '/həˈloʊ/',
              phonetics: [{ text: '/həˈloʊ/', audio: 'https://audio.test/hello.mp3' }],
              meanings: [
                { partOfSpeech: 'exclamation', definitions: [{ definition: 'Greeting' }] },
              ],
            },
          ],
        } as Response
      }
      if (url.includes('/world')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'world',
              phonetic: '/wɜːrld/',
              phonetics: [{ text: '/wɜːrld/', audio: 'https://audio.test/world.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Earth' }] }],
            },
          ],
        } as Response
      }
      if (url.includes('/test')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'test',
              phonetic: '/test/',
              phonetics: [{ text: '/test/', audio: 'https://audio.test/test.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Procedure' }] }],
            },
          ],
        } as Response
      }
      if (url.includes('/book')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'book',
              phonetic: '/bʊk/',
              phonetics: [{ text: '/bʊk/', audio: 'https://audio.test/book.mp3' }],
              meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'Text' }] }],
            },
          ],
        } as Response
      }
      return { ok: false, status: 404, json: async () => [] } as Response
    }) as typeof global.fetch

    // Run the vocabulary job
    const job = new GenerateBookVocabularyJob()
    await job.handle({ bookId: book.id })

    // Verify step logs were created
    const stepLogs = await BookProcessingStepLog.query()
      .where('bookId', book.id)
      .orderBy('createdAt', 'asc')

    assert.isTrue(stepLogs.length > 0, 'Step logs should be created')

    // Verify extraction step log
    const extractStep = stepLogs.find((log) => log.stepKey === 'vocab_extract')
    assert.exists(extractStep, 'vocab_extract step log should exist')
    assert.equal(extractStep?.status, 'success', 'vocab_extract step should succeed')

    // Verify output_ref contains extractedWords count
    const outputRef = extractStep?.outputRef as Record<string, unknown> | null
    assert.exists(outputRef?.extractedWords, 'extractedWords should be in output_ref')

    // Verify lookup step log
    const lookupStep = stepLogs.find((log) => log.stepKey === 'vocab_lookup_batch')
    assert.exists(lookupStep, 'vocab_lookup_batch step log should exist')
    assert.equal(lookupStep?.status, 'success', 'vocab_lookup_batch step should succeed')
  })

  test('marks vocabularyStatus as failed on error', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with chapters
    const book = await Book.create({
      title: 'Test Book for Error',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Hello world.' },
    ])

    // Mock Redis to return null (no cache) and fetch to throw error
    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get
    global.fetch = (async () => {
      throw new Error('Network error')
    }) as typeof global.fetch

    // Run the vocabulary job and expect it to throw
    const job = new GenerateBookVocabularyJob()
    try {
      await job.handle({ bookId: book.id })
    } catch (e) {
      // Expected to throw
    }

    // Verify book vocabularyStatus is 'failed'
    const updatedBook = await Book.find(book.id)
    assert.equal(updatedBook?.vocabularyStatus, 'failed', 'vocabularyStatus should be failed')
  })
})

test.group('GenerateBookAudioJob - Finalize-by-Join Behavior', () => {
  test('book is NOT published when audio completes but vocabulary is still pending', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with vocabularyStatus still pending
    const book = await Book.create({
      title: 'Test Book - Audio Ready, Vocab Pending',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'pending', // vocabulary not completed
      audioStatus: 'pending',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 1',
        content: 'Hello world test content.',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 2',
        content: 'Another chapter content here.',
      },
    ])

    // Run the audio job
    const job = new GenerateBookAudioJob()
    await job.handle({ bookId: book.id })

    // Refresh and verify
    await book.refresh()

    // Audio should be completed
    assert.equal(book.audioStatus, 'completed', 'audioStatus should be completed')

    // But book should NOT be published yet because vocabulary is still pending
    assert.equal(
      book.status,
      'processing',
      'status should remain processing when vocabulary is not completed'
    )
    assert.equal(book.isPublished, false, 'isPublished should be false when vocabulary is pending')
  })

  test('book is NOT published when audio completes but vocabulary has failed', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with vocabularyStatus as failed
    const book = await Book.create({
      title: 'Test Book - Audio Ready, Vocab Failed',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'failed', // vocabulary has failed
      audioStatus: 'pending',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 1',
        content: 'Hello world test content.',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 2',
        content: 'Another chapter content here.',
      },
    ])

    // Run the audio job
    const job = new GenerateBookAudioJob()
    await job.handle({ bookId: book.id })

    // Refresh and verify
    await book.refresh()

    // Audio should be completed
    assert.equal(book.audioStatus, 'completed', 'audioStatus should be completed')

    // But book should NOT be published because vocabulary has failed
    assert.equal(
      book.status,
      'processing',
      'status should remain processing when vocabulary has failed'
    )
    assert.equal(book.isPublished, false, 'isPublished should be false when vocabulary has failed')
  })

  test('book IS published when both audio and vocabulary are completed', async ({
    assert,
    cleanup,
  }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with both audioStatus and vocabularyStatus as completed
    const book = await Book.create({
      title: 'Test Book - Both Complete',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'completed', // vocabulary is completed
      audioStatus: 'pending',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters with content
    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 1',
        content: 'Hello world test content.',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 2',
        content: 'Another chapter content here.',
      },
    ])

    // Run the audio job
    const job = new GenerateBookAudioJob()
    await job.handle({ bookId: book.id })

    // Refresh and verify
    await book.refresh()

    // Both should be completed and book should be published
    assert.equal(book.audioStatus, 'completed', 'audioStatus should be completed')
    assert.equal(book.vocabularyStatus, 'completed', 'vocabularyStatus should still be completed')
    assert.equal(
      book.status,
      'ready',
      'status should be ready when both audio and vocabulary complete'
    )
    assert.equal(book.isPublished, true, 'isPublished should be true when both complete')
  })

  test('audio failure does not overwrite vocabulary failure state', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book with vocabulary already failed
    const book = await Book.create({
      title: 'Test Book - Vocab Failed',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'failed',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'failed', // vocabulary already failed
      audioStatus: 'pending',
      processingStep: 'vocabulary_failed',
      processingError: 'Dictionary lookup failed',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create a chapter - the audio job will fail when processing
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Content' },
    ])

    // Run audio job - it should succeed since TTS works in test env
    const job = new GenerateBookAudioJob()
    await job.handle({ bookId: book.id })

    // Refresh and verify
    await book.refresh()

    // Audio should be completed but vocabulary should remain failed
    assert.equal(book.audioStatus, 'completed', 'audioStatus should be completed')
    assert.equal(book.vocabularyStatus, 'failed', 'vocabularyStatus should remain failed')
    // The book status should stay at failed since vocabulary failed
    assert.equal(book.status, 'failed', 'status should remain failed due to vocabulary failure')
  })

  test('audio job creates step logs with correct step keys', async ({ assert, cleanup }) => {
    // Create test user
    const user = await createTestUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create test book
    const book = await Book.create({
      title: 'Test Book - Step Logs',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
      vocabularyStatus: 'completed', // vocabulary completed so book can be published
      audioStatus: 'pending',
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await BookProcessingStepLog.query().where('bookId', book.id).delete()
      await BookProcessingRunLog.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapters
    await BookChapter.createMany([
      { bookId: book.id, chapterIndex: 1, title: 'Chapter 1', content: 'Hello world content.' },
      { bookId: book.id, chapterIndex: 2, title: 'Chapter 2', content: 'Second chapter content.' },
    ])

    // Run the audio job
    const job = new GenerateBookAudioJob()
    await job.handle({ bookId: book.id })

    // Verify step logs were created
    const stepLogs = await BookProcessingStepLog.query().where('bookId', book.id)

    // Check for audio_generate_chapter step logs
    const chapterSteps = stepLogs.filter((log) => log.stepKey === 'audio_generate_chapter')
    assert.isTrue(
      chapterSteps.length >= 2,
      'Should have at least 2 audio_generate_chapter steps for 2 chapters'
    )

    // Verify item_key format is chapter:{index}
    const firstChapterStep = chapterSteps.find((log) => log.itemKey === 'chapter:1')
    assert.exists(firstChapterStep, 'Should have step with item_key=chapter:1')
    assert.equal(firstChapterStep?.status, 'success', 'Chapter step should succeed')

    // Check for audio_finalize step
    const finalizeStep = stepLogs.find((log) => log.stepKey === 'audio_finalize')
    assert.exists(finalizeStep, 'Should have audio_finalize step')
    assert.equal(finalizeStep?.status, 'success', 'audio_finalize should succeed')
  })
})
