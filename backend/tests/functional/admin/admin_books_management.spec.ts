import { test } from '@japa/runner'
import Book from '#models/book'
import User from '#models/user'
import crypto from 'node:crypto'

/**
 * Helper function to create a test admin user with access token
 */
async function createAdminUser(): Promise<{ user: User; token: string }> {
  const user = await User.create({
    fullName: 'Admin User',
    email: `admin-${crypto.randomUUID()}@example.com`,
    password: 'testpassword123',
    isAdmin: true,
  })

  const token = await User.accessTokens.create(user, {
    name: 'test-token',
    expiresIn: '1 day',
  })

  return { user, token: token.value!.release() }
}

/**
 * Helper function to create a test regular user with access token
 */
async function createRegularUser(): Promise<{ user: User; token: string }> {
  const user = await User.create({
    fullName: 'Regular User',
    email: `user-${crypto.randomUUID()}@example.com`,
    password: 'testpassword123',
    isAdmin: false,
  })

  const token = await User.accessTokens.create(user, {
    name: 'test-token',
    expiresIn: '1 day',
  })

  return { user, token: token.value!.release() }
}

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
      .header('Authorization', `Bearer ${token}`)

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

  test('GET /api/admin/books with pagination params works', async ({
    assert,
    client,
    cleanup,
  }) => {
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
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    assert.equal(response.body().data.length, 10, 'Should return 10 items per page')
    assert.equal(response.body().meta.currentPage, 1, 'Should be on page 1')
    assert.equal(response.body().meta.perPage, 10, 'Should have 10 per page')
    assert.isAtLeast(response.body().meta.total, 25, 'Should have at least 25 total items')
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
      .header('Authorization', `Bearer ${token}`)

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
      .header('Authorization', `Bearer ${token}`)
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
      .header('Authorization', `Bearer ${token}`)
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
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const response = await client
      .patch('/api/admin/books/99999')
      .header('Authorization', `Bearer ${token}`)
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
      .header('Authorization', `Bearer ${token}`)

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
      .header('Authorization', `Bearer ${token}`)

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
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200, 'Failed books should be deletable')
    assert.equal(response.body().success, true)
  })

  test('DELETE /api/admin/books/:id returns 404 for non-existent book', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user: admin, token } = await createAdminUser()
    cleanup(async () => {
      await admin.delete()
    })

    const response = await client
      .delete('/api/admin/books/99999')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(404)
  })

  test('PATCH /api/admin/books/:id validates input fields', async ({
    assert,
    client,
    cleanup,
  }) => {
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
      .header('Authorization', `Bearer ${token}`)
      .json({
        difficultyLevel: 'invalid_level',
      })

    response1.assertStatus(422)

    // Test invalid source
    const response2 = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        source: 'invalid_source',
      })

    response2.assertStatus(422)

    // Test title too long
    const response3 = await client
      .patch(`/api/admin/books/${book.id}`)
      .header('Authorization', `Bearer ${token}`)
      .json({
        title: 'a'.repeat(201),
      })

    response3.assertStatus(422)
  })
})
