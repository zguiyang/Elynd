import { test } from '@japa/runner'
import crypto, { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import ChapterTranslation from '#models/chapter_translation'
import TranslateChapterJob from '#jobs/translate_chapter_job'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Chapter Translations API - Trigger Contract', (group) => {
  const originalDispatch = TranslateChapterJob.dispatch

  group.each.teardown(() => {
    TranslateChapterJob.dispatch = originalDispatch
  })

  test('POST /api/chapters/:id/translations requeues failed identity instead of 500', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'Translation Failed Identity Book',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 1200,
      readingTime: 6,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    const chapter = await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'This is a test paragraph.\n\nThis is a second paragraph.',
    })

    const sourceLanguage = 'en'
    const targetLanguage = 'zh'
    const contentHash = createHash('sha256')
      .update(`${sourceLanguage}::${targetLanguage}::${chapter.title}\n${chapter.content}`)
      .digest('hex')

    const failedTranslation = await ChapterTranslation.create({
      chapterId: chapter.id,
      sourceLanguage,
      targetLanguage,
      contentHash,
      status: 'failed',
      errorMessage: 'boom',
      createdByUserId: user.id,
    })
    cleanup(async () => {
      await ChapterTranslation.query().where('id', failedTranslation.id).delete()
    })

    const dispatched: number[] = []
    TranslateChapterJob.dispatch = (async (payload: { translationId: number }) => {
      dispatched.push(payload.translationId)
    }) as typeof TranslateChapterJob.dispatch

    const response = await client
      .post(`/api/chapters/${chapter.id}/translations`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        sourceLanguage,
        targetLanguage,
      })

    assert.equal(response.status(), 202)
    assert.equal(response.body().status, 'queued')
    assert.equal(response.body().translationId, failedTranslation.id)
    assert.isNull(response.body().data)

    const refreshed = await ChapterTranslation.findOrFail(failedTranslation.id)
    assert.equal(refreshed.status, 'queued')
    assert.isNull(refreshed.errorMessage)
    assert.equal(dispatched.length, 1)
    assert.equal(dispatched[0], failedTranslation.id)
  })

  test('POST /api/chapters/:id/translations re-dispatches stale queued identity', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'Translation Stale Queued Identity Book',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 1200,
      readingTime: 6,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    const chapter = await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'This is a test paragraph.\n\nThis is a second paragraph.',
    })

    const sourceLanguage = 'en'
    const targetLanguage = 'zh'
    const contentHash = createHash('sha256')
      .update(`${sourceLanguage}::${targetLanguage}::${chapter.title}\n${chapter.content}`)
      .digest('hex')

    const staleQueuedTranslation = await ChapterTranslation.create({
      chapterId: chapter.id,
      sourceLanguage,
      targetLanguage,
      contentHash,
      status: 'queued',
      errorMessage: null,
      createdByUserId: user.id,
    })
    cleanup(async () => {
      await ChapterTranslation.query().where('id', staleQueuedTranslation.id).delete()
    })

    await db
      .from('chapter_translations')
      .where('id', staleQueuedTranslation.id)
      .update({ updated_at: new Date(Date.now() - 10 * 60 * 1000) })

    const dispatched: number[] = []
    TranslateChapterJob.dispatch = (async (payload: { translationId: number }) => {
      dispatched.push(payload.translationId)
    }) as typeof TranslateChapterJob.dispatch

    const response = await client
      .post(`/api/chapters/${chapter.id}/translations`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        sourceLanguage,
        targetLanguage,
      })

    assert.equal(response.status(), 202)
    assert.equal(response.body().status, 'queued')
    assert.equal(response.body().translationId, staleQueuedTranslation.id)
    assert.isNull(response.body().data)
    assert.equal(dispatched.length, 1)
    assert.equal(dispatched[0], staleQueuedTranslation.id)
  })
})
