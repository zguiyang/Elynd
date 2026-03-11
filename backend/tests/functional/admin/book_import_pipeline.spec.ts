import { test } from '@japa/runner'
import Book from '#models/book'
import BookProcessingRunLog from '#models/book_processing_run_log'
import BookProcessingStepLog from '#models/book_processing_step_log'
import BookChapterAudio from '#models/book_chapter_audio'

test.group('Book Import Pipeline Models', () => {
  test('BookProcessingRunLog model can be imported and instantiated', async ({ assert }) => {
    const runLog = new BookProcessingRunLog()
    assert.isTrue(runLog instanceof BookProcessingRunLog, 'BookProcessingRunLog should be importable')
  })

  test('BookProcessingStepLog model can be imported and instantiated', async ({ assert }) => {
    const stepLog = new BookProcessingStepLog()
    assert.isTrue(stepLog instanceof BookProcessingStepLog, 'BookProcessingStepLog should be importable')
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
