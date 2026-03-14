import { test } from '@japa/runner'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import BookVocabulary from '#models/book_vocabulary'
import crypto from 'node:crypto'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

const createAdminUser = () =>
  createAuthenticatedUser({
    fullName: 'Admin User',
    emailPrefix: 'admin',
    isAdmin: true,
  })

const createRegularUser = () =>
  createAuthenticatedUser({
    fullName: 'Regular User',
    emailPrefix: 'user',
    isAdmin: false,
  })

test.group('Admin Books Management API', () => {
  test('GET /api/admin/books returns paginated books sorted by newest first', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    // Create test books
    const book1 = await Book.create({
      title: 'Old Book',
      author: 'Author 1',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: true,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book1.delete())

    const book2 = await Book.create({
      title: 'New Book',
      author: 'Author 2',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      wordCount: 2000,
      readingTime: 10,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book2.delete())

    const response = await client
      .get('/api/admin/books')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.isObject(response.body(), 'Response should be an object')

    // Should have pagination structure
    assert.isArray(response.body().data, 'Response should have data array')
    assert.isObject(response.body().meta, 'Response should have meta for pagination')

    // Newest first - book2 should come first
    const data = response.body().data
    assert.equal(data[0].title, 'New Book', 'First book should be the newest')
    assert.equal(data[1].title, 'Old Book', 'Second book should be older')
  })

  test('GET /api/admin/books with pagination params works', async ({ assert, client, cleanup }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    // Create multiple books
    for (let i = 1; i <= 25; i++) {
      const book = await Book.create({
        title: `Book ${i}`,
        author: 'Author',
        source: 'user_uploaded',
        difficultyLevel: 'beginner',
        status: 'ready',
        wordCount: 1000,
        readingTime: 5,
        isPublished: true,
        createdBy: admin.id,
        contentHash: crypto.randomUUID() + i,
      })
      cleanup(async () => await book.delete())
    }

    const response = await client
      .get('/api/admin/books?page=1&perPage=10')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().data.length, 10, 'Should return 10 items per page')
    assert.equal(response.body().meta.currentPage, 1, 'Should be on page 1')
    assert.equal(response.body().meta.perPage, 10, 'Should have 10 per page')
    assert.isAtLeast(response.body().meta.total, 25, 'Should have at least 25 total items')
  })

  test('GET /api/admin/books returns chapter audio summary for processing books', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Audio Progress Book',
      author: 'Audio Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'processing',
      processingStep: 'generating_audio',
      processingProgress: 80,
      audioStatus: 'processing',
      wordCount: 1500,
      readingTime: 8,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: crypto.randomUUID(),
      vocabularyStatus: 'pending',
    })

    cleanup(async () => {
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
    })

    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 0,
        title: 'Chapter 1',
        content: 'Content 1',
      },
      {
        bookId: book.id,
        chapterIndex: 1,
        title: 'Chapter 2',
        content: 'Content 2',
      },
      {
        bookId: book.id,
        chapterIndex: 2,
        title: 'Chapter 3',
        content: 'Content 3',
      },
    ])

    await BookChapterAudio.createMany([
      {
        bookId: book.id,
        chapterIndex: 0,
        textHash: crypto.randomUUID().replace(/-/g, ''),
        voiceHash: 'default-voice',
        audioPath: '/audio/chapter-0.mp3',
        durationMs: 1200,
        status: 'completed',
        errorMessage: null,
      },
      {
        bookId: book.id,
        chapterIndex: 1,
        textHash: crypto.randomUUID().replace(/-/g, ''),
        voiceHash: 'default-voice',
        audioPath: null,
        durationMs: null,
        status: 'failed',
        errorMessage: 'TTS failed',
      },
    ])

    const response = await client
      .get('/api/admin/books')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const targetBook = response.body().data.find((item: { id: number }) => item.id === book.id)
    assert.exists(targetBook, 'Response should contain the target book')
    assert.equal(targetBook.audioStatus, 'processing')
    assert.deepEqual(targetBook.chapterAudioSummary, {
      total: 3,
      completed: 1,
      pending: 0,
      failed: 1,
    })
  })

  test('GET /api/admin/books returns bookHash and vocabularyStatus fields', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Pipeline Observability Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      processingStep: 'generating_vocabulary',
      processingProgress: 50,
      audioStatus: 'completed',
      vocabularyStatus: 'processing',
      wordCount: 2000,
      readingTime: 10,
      isPublished: true,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: 'abc123def456',
    })
    cleanup(async () => await book.delete())

    const response = await client
      .get('/api/admin/books')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const targetBook = response.body().data.find((item: { id: number }) => item.id === book.id)
    assert.exists(targetBook, 'Response should contain the target book')
    assert.equal(targetBook.bookHash, 'abc123def456', 'bookHash should be returned')
    assert.equal(targetBook.vocabularyStatus, 'processing', 'vocabularyStatus should be returned')
    assert.equal(targetBook.audioStatus, 'completed', 'audioStatus should be returned')
  })

  test('GET /api/admin/books/:id/status returns vocabularyStatus and bookHash in enriched status', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Enriched Status Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'advanced',
      status: 'ready',
      processingStep: null,
      processingProgress: 100,
      audioStatus: 'completed',
      vocabularyStatus: 'completed',
      wordCount: 3000,
      readingTime: 15,
      isPublished: true,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: 'xyz789bookhash',
    })
    cleanup(async () => await book.delete())

    const response = await client
      .get(`/api/admin/books/${book.id}/status`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const body = response.body()
    assert.equal(
      body.vocabularyStatus,
      'completed',
      'vocabularyStatus should be in enriched status'
    )
    assert.equal(body.bookHash, 'xyz789bookhash', 'bookHash should be in enriched status')
    assert.equal(body.audioStatus, 'completed', 'audioStatus should be in enriched status')
  })

  test('GET /api/admin/books/:id/status returns vocabularySummary with counts', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Vocabulary Summary Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'ready',
      processingStep: null,
      processingProgress: 100,
      audioStatus: 'completed',
      vocabularyStatus: 'completed',
      wordCount: 2000,
      readingTime: 10,
      isPublished: true,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: 'vocab123hash',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create vocabulary items for the book
    await BookVocabulary.createMany([
      {
        bookId: book.id,
        word: 'hello',
        lemma: 'hello',
        frequency: 100,
        meaning: 'greeting',
        sentence: 'Hello world',
      },
      {
        bookId: book.id,
        word: 'world',
        lemma: 'world',
        frequency: 90,
        meaning: 'earth',
        sentence: 'Hello world',
      },
      {
        bookId: book.id,
        word: 'test',
        lemma: 'test',
        frequency: 80,
        meaning: 'examination',
        sentence: 'Take a test',
      },
    ])

    const response = await client
      .get(`/api/admin/books/${book.id}/status`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const body = response.body()
    assert.exists(body.vocabularySummary, 'vocabularySummary should exist in response')
    assert.equal(body.vocabularySummary.total, 3, 'total should be 3')
    assert.equal(
      body.vocabularySummary.completed,
      3,
      'completed should be 3 when vocabularyStatus is completed'
    )
    assert.equal(body.vocabularySummary.pending, 0, 'pending should be 0')
    assert.equal(body.vocabularySummary.failed, 0, 'failed should be 0')
  })

  test('GET /api/admin/books/:id/status returns vocabularySummary with pending equals total when vocabularyStatus is pending', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Pending Vocabulary Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      processingStep: 'generating_vocabulary',
      processingProgress: 30,
      audioStatus: 'completed',
      vocabularyStatus: 'pending',
      wordCount: 2000,
      readingTime: 10,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: 'pendingvocab123',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create vocabulary items for the book
    await BookVocabulary.createMany([
      {
        bookId: book.id,
        word: 'apple',
        lemma: 'apple',
        frequency: 100,
        meaning: 'fruit',
        sentence: 'I eat an apple',
      },
      {
        bookId: book.id,
        word: 'banana',
        lemma: 'banana',
        frequency: 90,
        meaning: 'fruit',
        sentence: 'I eat a banana',
      },
      {
        bookId: book.id,
        word: 'orange',
        lemma: 'orange',
        frequency: 80,
        meaning: 'fruit',
        sentence: 'I eat an orange',
      },
      {
        bookId: book.id,
        word: 'grape',
        lemma: 'grape',
        frequency: 70,
        meaning: 'fruit',
        sentence: 'I eat a grape',
      },
    ])

    const response = await client
      .get(`/api/admin/books/${book.id}/status`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const body = response.body()
    assert.exists(body.vocabularySummary, 'vocabularySummary should exist in response')
    assert.equal(body.vocabularySummary.total, 4, 'total should be 4')
    assert.equal(
      body.vocabularySummary.pending,
      4,
      'pending should equal total when vocabularyStatus is pending'
    )
    assert.equal(body.vocabularySummary.completed, 0, 'completed should be 0')
    assert.equal(body.vocabularySummary.failed, 0, 'failed should be 0')
  })

  test('GET /api/admin/books/:id/status returns vocabularySummary with failed equals total when vocabularyStatus is failed', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Failed Vocabulary Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
      status: 'processing',
      processingStep: 'generating_vocabulary',
      processingProgress: 30,
      audioStatus: 'completed',
      vocabularyStatus: 'failed',
      processingError: 'Vocabulary generation failed',
      wordCount: 2000,
      readingTime: 10,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      bookHash: 'failedvocab123',
    })
    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await book.delete()
    })

    // Create vocabulary items for the book (with some failed items)
    await BookVocabulary.createMany([
      {
        bookId: book.id,
        word: 'hello',
        lemma: 'hello',
        frequency: 100,
        meaning: 'greeting',
        sentence: 'Hello world',
      },
      {
        bookId: book.id,
        word: 'world',
        lemma: 'world',
        frequency: 90,
        meaning: 'earth',
        sentence: 'Hello world',
      },
    ])

    const response = await client
      .get(`/api/admin/books/${book.id}/status`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const body = response.body()
    assert.exists(body.vocabularySummary, 'vocabularySummary should exist in response')
    assert.equal(body.vocabularySummary.total, 2, 'total should be 2')
    assert.equal(
      body.vocabularySummary.failed,
      2,
      'failed should equal total when vocabularyStatus is failed'
    )
    assert.equal(body.vocabularySummary.pending, 0, 'pending should be 0')
    assert.equal(body.vocabularySummary.completed, 0, 'completed should be 0')
  })

  test('GET /api/admin/books requires admin authentication', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: regularUser, token } = await createRegularUser()
    cleanup(async () => {
      await regularUser.delete()
    })

    const response = await client
      .get('/api/admin/books')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(403)
    // Response might be in different format
    const body = response.body()
    if (body.errors && body.errors[0]) {
      assert.equal(body.errors[0].message, 'Forbidden: Admin access required')
    } else if (body.message) {
      assert.equal(body.message, 'Forbidden: Admin access required')
    }
  })

  test('PATCH /api/admin/books/:id updates book when status is not processing', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Original Title',
      author: 'Original Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book.delete())

    const response = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        title: 'Updated Title',
        author: 'Updated Author',
      })

    response.assertStatus(200)
    assert.equal(response.body().title, 'Updated Title')
    assert.equal(response.body().author, 'Updated Author')
  })

  test('PATCH /api/admin/books/:id returns 400 when status is processing', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Processing Book',
      author: 'Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 50,
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book.delete())

    const response = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        title: 'Updated Title',
      })

    response.assertStatus(400)
    // Response might be in different format
    const body = response.body()
    if (body.errors && body.errors[0]) {
      assert.equal(body.errors[0].message, 'Book is processing, operation not allowed')
    } else if (body.message) {
      assert.equal(body.message, 'Book is processing, operation not allowed')
    }
  })

  test('PATCH /api/admin/books/:id returns 404 for non-existent book', async ({
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const response = await client
      .patch('/api/admin/books/99999')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        title: 'Updated Title',
      })

    response.assertStatus(404)
  })

  test('DELETE /api/admin/books/:id deletes book when status is ready', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Book to Delete',
      author: 'Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    const bookId = book.id

    const response = await client
      .delete(`/api/admin/books/${bookId}`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().success, true)

    // Verify book is deleted
    const deletedBook = await Book.find(bookId)
    assert.isNull(deletedBook, 'Book should be deleted')
  })

  test('DELETE /api/admin/books/:id returns 400 when status is processing', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Processing Book to Delete',
      author: 'Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'processing',
      processingStep: 'parsing',
      processingProgress: 50,
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book.delete())

    const response = await client
      .delete(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(400)
    // Response might be in different format
    const body = response.body()
    if (body.errors && body.errors[0]) {
      assert.equal(body.errors[0].message, 'Book is processing, operation not allowed')
    } else if (body.message) {
      assert.equal(body.message, 'Book is processing, operation not allowed')
    }
  })

  test('DELETE /api/admin/books/:id works for failed status', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Failed Book to Delete',
      author: 'Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'failed',
      processingError: 'Some error',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book.delete())

    const response = await client
      .delete(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().success, true)
  })

  test('DELETE /api/admin/books/:id returns 404 for non-existent book', async ({
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const response = await client
      .delete('/api/admin/books/99999')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })

  test('PATCH /api/admin/books/:id validates input fields', async ({ client, cleanup }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Test Book',
      author: 'Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => await book.delete())

    // Test invalid difficulty level
    const response1 = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        difficultyLevel: 'invalid_level',
      })

    response1.assertStatus(422)

    // Test invalid source
    const response2 = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        source: 'invalid_source',
      })

    response2.assertStatus(422)

    // Test title too long
    const response3 = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))
      .json({
        title: 'a'.repeat(201),
      })

    response3.assertStatus(422)
  })

  test('POST /api/admin/books/:id/retry-vocabulary retries vocabulary generation for failed vocabulary', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Failed Vocabulary Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      audioStatus: 'completed',
      vocabularyStatus: 'failed',
    })
    cleanup(async () => await book.delete())

    const response = await client
      .post(`/api/admin/books/${book.id}/retry-vocabulary`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().success, true)
    assert.equal(response.body().message, 'Vocabulary retry task added to queue')
    assert.equal(response.body().vocabularyStatus, 'pending')
  })

  test('POST /api/admin/books/:id/retry-audio sets book to processing and clears processingError', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Audio Retry Test Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'failed',
      processingStep: 'failed',
      processingProgress: 100,
      processingError: 'TTS failed previously',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      audioStatus: 'failed',
      vocabularyStatus: 'pending',
    })
    cleanup(async () => await book.delete())

    const response = await client
      .post(`/api/admin/books/${book.id}/retry-audio`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().success, true)
    assert.equal(response.body().status, 'processing')

    const reloadedBook = await Book.findOrFail(book.id)
    assert.equal(reloadedBook.status, 'processing')
    assert.equal(reloadedBook.audioStatus, 'pending')
    assert.isNull(reloadedBook.processingError)
  })

  test('POST /api/admin/books/:id/retry-vocabulary returns 400 when vocabulary is not failed', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    // Test with completed vocabulary status
    const book = await Book.create({
      title: 'Completed Vocabulary Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'ready',
      wordCount: 1000,
      readingTime: 5,
      isPublished: true,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      audioStatus: 'completed',
      vocabularyStatus: 'completed',
    })
    cleanup(async () => await book.delete())

    const response = await client
      .post(`/api/admin/books/${book.id}/retry-vocabulary`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(400)
    const body = response.body()
    if (body.errors && body.errors[0]) {
      assert.equal(body.errors[0].message, 'Can only retry books with failed vocabulary status')
    } else if (body.message) {
      assert.equal(body.message, 'Can only retry books with failed vocabulary status')
    }
  })

  test('POST /api/admin/books/:id/retry-vocabulary returns 404 for non-existent book', async ({
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const response = await client
      .post('/api/admin/books/99999/retry-vocabulary')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })

  test('POST /api/admin/books/:id/retry-vocabulary does not modify audio path', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const book = await Book.create({
      title: 'Vocabulary Retry Test Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'beginner',
      status: 'processing',
      wordCount: 1000,
      readingTime: 5,
      isPublished: false,
      createdBy: admin.id,
      contentHash: crypto.randomUUID(),
      audioStatus: 'completed',
      vocabularyStatus: 'failed',
    })
    cleanup(async () => await book.delete())

    // Call retry-vocabulary
    const response = await client
      .post(`/api/admin/books/${book.id}/retry-vocabulary`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    // Reload book from database to verify audio status is unchanged
    const reloadedBook = await Book.find(book.id)
    assert.equal(reloadedBook?.audioStatus, 'completed', 'Audio status should not be modified')
    assert.equal(
      reloadedBook?.vocabularyStatus,
      'pending',
      'Vocabulary status should be reset to pending'
    )
  })
})
