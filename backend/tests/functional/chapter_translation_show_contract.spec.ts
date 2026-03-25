import { test } from '@japa/runner'
import crypto from 'node:crypto'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Chapter Translations API - Show Contract', () => {
  test('GET /api/chapters/:id/translations returns empty payload when translation does not exist', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'Translation Show Empty Book',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 800,
      readingTime: 4,
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
      content: 'Only one paragraph for contract validation.',
    })

    const response = await client
      .get(`/api/chapters/${chapter.id}/translations`)
      .header('Authorization', bearerAuthHeader(token))
      .qs({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
      })

    response.assertStatus(200)
    assert.isNull(response.body().status)
    assert.isNull(response.body().translationId)
    assert.isNull(response.body().data)
  })
})
