import { test } from '@japa/runner'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import crypto from 'node:crypto'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Books Reading API - Chapter Contract', () => {
  test('GET /api/books/:id/chapters/0 returns chapter with audio at top level', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create authenticated user
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create a published book
    const book = await Book.create({
      title: 'Test Book for Chapter API',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 5000,
      readingTime: 25,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapter with chapterIndex = 0
    await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'This is the content of Chapter 1.',
    })

    // Create corresponding book_chapter_audios record
    const audioPath = `book/voices/${book.id}/chapter-0.mp3`
    await BookChapterAudio.create({
      bookId: book.id,
      chapterIndex: 0,
      textHash: 'test-text-hash',
      voiceHash: 'default-voice',
      audioPath: audioPath,
      durationMs: 1234,
      status: 'completed',
    })

    // Request GET /api/books/:id/chapters/0
    const response = await client
      .get(`/api/books/${book.id}/chapters/0`)
      .header('Authorization', bearerAuthHeader(token))

    const body = response.body()

    // Assert response structure
    assert.equal(response.status(), 200, 'Response should return 200 OK')
    assert.equal(body.chapterIndex, 0, 'chapterIndex should be 0')
    assert.equal(body.title, 'Chapter 1', 'title should match')
    assert.equal(body.content, 'This is the content of Chapter 1.', 'content should match')

    // Assert top-level audio fields (contract test)
    assert.equal(body.audioUrl, audioPath, 'audioUrl should be at top level')
    assert.equal(body.audioStatus, 'completed', 'audioStatus should be at top level')
    assert.equal(body.audioDurationMs, 1234, 'audioDurationMs should be at top level')
  })

  test('GET /api/books/:id/chapters/0 returns null audio fields when no audio record exists', async ({
    assert,
    client,
    cleanup,
  }) => {
    // Create authenticated user
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create a published book
    const book = await Book.create({
      title: 'Test Book for No Audio',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 1,
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create chapter without audio record
    await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'Content without audio.',
    })

    // Request GET /api/books/:id/chapters/0 (no audio record created)
    const response = await client
      .get(`/api/books/${book.id}/chapters/0`)
      .header('Authorization', bearerAuthHeader(token))

    const body = response.body()

    // Assert response structure
    assert.equal(response.status(), 200, 'Response should return 200 OK')
    assert.equal(body.chapterIndex, 0, 'chapterIndex should be 0')
    assert.equal(body.title, 'Chapter 1', 'title should match')

    // Assert null audio fields when no audio record exists
    assert.isNull(body.audioUrl, 'audioUrl should be null when no audio record')
    assert.isNull(body.audioStatus, 'audioStatus should be null when no audio record')
    assert.isNull(body.audioDurationMs, 'audioDurationMs should be null when no audio record')
  })

  test('GET /api/books/:id/chapters/:chapterIndex returns 404 for non-existent book', async ({
    client,
    cleanup,
  }) => {
    // Create authenticated user
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    // Request with non-existent book ID
    const response = await client
      .get('/api/books/99999/chapters/0')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })

  test('GET /api/books/:id/chapters/:chapterIndex returns 404 for non-existent chapter', async ({
    client,
    cleanup,
  }) => {
    // Create authenticated user
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    // Create a published book with one chapter
    const book = await Book.create({
      title: 'Test Book for Missing Chapter',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 1,
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create only chapter 0
    await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'Content',
    })

    // Request non-existent chapter (chapterIndex = 5)
    const response = await client
      .get(`/api/books/${book.id}/chapters/5`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })
})
