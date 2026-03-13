import { test } from '@japa/runner'
import Book from '#models/book'
import { BOOK_IMPORT_PROGRESS, BOOK_IMPORT_STEP } from '#constants'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Admin Book Import Pipeline Contract', () => {
  test('canonical scheduler step keys should match final pipeline', async ({ assert }) => {
    assert.equal(BOOK_IMPORT_STEP.RECEIVED, 'import_received')
    assert.equal(BOOK_IMPORT_STEP.FILE_VALIDATING, 'file_validating')
    assert.equal(BOOK_IMPORT_STEP.SEMANTIC_METADATA, 'semantic_metadata')
    assert.equal(BOOK_IMPORT_STEP.SEMANTIC_CHAPTERS, 'semantic_chapters')
    assert.equal(BOOK_IMPORT_STEP.CONTENT_HASHING, 'content_hashing')
    assert.equal(BOOK_IMPORT_STEP.VOCABULARY_EXTRACTING, 'vocabulary_extracting')
    assert.equal(BOOK_IMPORT_STEP.PARALLEL_PROCESSING, 'parallel_processing')
    assert.equal(BOOK_IMPORT_STEP.FINALIZING_PUBLISH, 'finalizing_publish')
    assert.equal(BOOK_IMPORT_STEP.COMPLETED, 'completed')
    assert.equal(BOOK_IMPORT_STEP.FAILED, 'failed')
  })

  test('deterministic progress weights should sum to 100', async ({ assert }) => {
    const sum =
      BOOK_IMPORT_PROGRESS.IMPORT_RECEIVED +
      BOOK_IMPORT_PROGRESS.FILE_VALIDATING +
      BOOK_IMPORT_PROGRESS.SEMANTIC_METADATA +
      BOOK_IMPORT_PROGRESS.SEMANTIC_CHAPTERS +
      BOOK_IMPORT_PROGRESS.CONTENT_HASHING +
      BOOK_IMPORT_PROGRESS.VOCABULARY_EXTRACTING +
      BOOK_IMPORT_PROGRESS.PARALLEL_PROCESSING +
      BOOK_IMPORT_PROGRESS.FINALIZING_PUBLISH

    assert.equal(sum, 100)
    assert.equal(BOOK_IMPORT_PROGRESS.TOTAL_MAX, 100)
  })

  test('book model should expose raw file persistence fields', async ({ assert }) => {
    const book = new Book()
    book.rawFilePath = 'book/raw/test.txt'
    book.rawFileName = 'test.txt'
    book.rawFileExt = 'txt'
    book.rawFileSize = 1234
    book.rawFileHash = 'abc'

    assert.equal(book.rawFilePath, 'book/raw/test.txt')
    assert.equal(book.rawFileName, 'test.txt')
    assert.equal(book.rawFileExt, 'txt')
    assert.equal(book.rawFileSize, 1234)
    assert.equal(book.rawFileHash, 'abc')
  })

  test('parse endpoint should be removed from runtime contract', async ({ client, assert }) => {
    const { user, token } = await createAuthenticatedUser({ isAdmin: true })

    try {
      const response = await client
        .post('/api/admin/books/parse')
        .headers({ authorization: bearerAuthHeader(token) })
      response.assertStatus(404)
    } finally {
      await user.delete()
    }

    assert.isTrue(true)
  })

  test('import endpoint should require multipart file', async ({ client }) => {
    const { user, token } = await createAuthenticatedUser({ isAdmin: true })

    try {
      const response = await client
        .post('/api/admin/books/import')
        .header('content-type', 'application/json')
        .headers({ authorization: bearerAuthHeader(token) })
        .json({
          source: 'user_uploaded',
          bookHash: 'abc123',
        })

      response.assertStatus(400)
    } finally {
      await user.delete()
    }
  })
})
