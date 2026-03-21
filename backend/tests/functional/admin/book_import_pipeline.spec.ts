import { test } from '@japa/runner'
import Book from '#models/book'
import { BOOK_IMPORT_PROGRESS, BOOK_IMPORT_STEP } from '#constants'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Admin Book Import Pipeline Contract', () => {
  test('canonical scheduler step keys should match final pipeline', async ({ assert }) => {
    assert.equal(BOOK_IMPORT_STEP.PREPARE_IMPORT, 'prepare_import')
    assert.equal(BOOK_IMPORT_STEP.SEMANTIC_CLEAN, 'semantic_clean')
    assert.equal(BOOK_IMPORT_STEP.BUILD_CONTENT_AND_VOCAB_SEED, 'build_content_and_vocab_seed')
    assert.equal(BOOK_IMPORT_STEP.ENRICH_VOCABULARY, 'enrich_vocabulary')
    assert.equal(BOOK_IMPORT_STEP.GENERATE_TTS, 'generate_tts')
    assert.equal(BOOK_IMPORT_STEP.FINALIZE_IMPORT, 'finalize_import')
    assert.equal(BOOK_IMPORT_STEP.COMPLETED, 'completed')
    assert.equal(BOOK_IMPORT_STEP.FAILED, 'failed')
  })

  test('deterministic progress weights should sum to 100', async ({ assert }) => {
    const sum =
      BOOK_IMPORT_PROGRESS.PREPARE_IMPORT +
      BOOK_IMPORT_PROGRESS.SEMANTIC_CLEAN +
      BOOK_IMPORT_PROGRESS.BUILD_CONTENT_AND_VOCAB_SEED +
      BOOK_IMPORT_PROGRESS.ENRICH_VOCABULARY +
      BOOK_IMPORT_PROGRESS.GENERATE_TTS +
      BOOK_IMPORT_PROGRESS.FINALIZE_IMPORT

    assert.equal(sum, 100)
    assert.equal(BOOK_IMPORT_PROGRESS.TOTAL_MAX, 100)
  })

  test('book model should expose raw file persistence fields', async ({ assert }) => {
    const book = new Book()
    book.rawFilePath = 'book/raw/test.epub'
    book.rawFileName = 'test.epub'
    book.rawFileExt = 'epub'
    book.rawFileSize = 1234
    book.rawFileHash = 'abc'

    assert.equal(book.rawFilePath, 'book/raw/test.epub')
    assert.equal(book.rawFileName, 'test.epub')
    assert.equal(book.rawFileExt, 'epub')
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
