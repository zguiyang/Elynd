import { test } from '@japa/runner'
import crypto from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import Tag from '#models/tag'
import BookVocabulary from '#models/book_vocabulary'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

async function createPublishedBook(userId: number, attributes?: Partial<Book>) {
  return await Book.create({
    title: `Book ${crypto.randomUUID()}`,
    author: 'Catalog Author',
    source: 'user_uploaded',
    levelId: 1,
    status: 'ready',
    wordCount: 900,
    readingTime: 5,
    isPublished: true,
    createdBy: userId,
    contentHash: crypto.randomUUID(),
    description: 'Catalog description',
    ...attributes,
  })
}

const hasLegacyMeaningColumn = async () => {
  const result = await db.rawQuery(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'book_vocabularies'
    AND column_name = 'meaning'
    LIMIT 1
  `)

  return (result.rows || []).length > 0
}

test.group('Books API catalog contract', () => {
  test('GET /api/books filters by difficulty and tag, and GET /api/books/:id returns only published books', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Books User',
      emailPrefix: 'books',
    })
    const tag = await Tag.create({
      name: `Catalog Tag ${crypto.randomUUID()}`,
      slug: `catalog-tag-${crypto.randomUUID()}`,
    })

    const matchingBook = await createPublishedBook(user.id, {
      title: 'Matching Book',
      levelId: 2,
    })

    const hiddenBook = await createPublishedBook(user.id, {
      title: 'Hidden Book',
      levelId: 2,
      isPublished: false,
    })

    cleanup(async () => {
      await matchingBook.related('tags').detach([tag.id])
      await BookVocabulary.query().whereIn('bookId', [matchingBook.id, hiddenBook.id]).delete()
      await BookChapterAudio.query().whereIn('bookId', [matchingBook.id, hiddenBook.id]).delete()
      await BookChapter.query().whereIn('bookId', [matchingBook.id, hiddenBook.id]).delete()
      await hiddenBook.delete()
      await matchingBook.delete()
      await tag.delete()
      await user.delete()
    })

    await matchingBook.related('tags').attach([tag.id])

    const listResponse = await client
      .get('/api/books')
      .qs({
        levelId: 2,
        tagId: tag.id,
      })
      .header('Authorization', bearerAuthHeader(token))

    listResponse.assertStatus(200)

    const listedBook = listResponse
      .body()
      .data.find((item: { id: number }) => item.id === matchingBook.id)

    assert.exists(listedBook)
    assert.equal(listedBook.title, 'Matching Book')

    const showResponse = await client
      .get(`/api/books/${matchingBook.id}`)
      .header('Authorization', bearerAuthHeader(token))

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().id, matchingBook.id)
    assert.equal(showResponse.body().title, 'Matching Book')

    const hiddenShowResponse = await client
      .get(`/api/books/${hiddenBook.id}`)
      .header('Authorization', bearerAuthHeader(token))

    hiddenShowResponse.assertStatus(404)
  })

  test('GET /api/books/:id/vocabulary returns stored vocabulary ordered by creation order', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Books User',
      emailPrefix: 'books',
    })
    const book = await createPublishedBook(user.id, {
      title: 'Vocabulary Book',
    })

    cleanup(async () => {
      await BookVocabulary.query().where('bookId', book.id).delete()
      await book.delete()
      await user.delete()
    })

    const legacyMeaningColumnEnabled = await hasLegacyMeaningColumn()

    if (legacyMeaningColumnEnabled) {
      await db.table('book_vocabularies').insert({
        book_id: book.id,
        word: 'apple',
        lemma: 'apple',
        frequency: 2,
        meaning: '苹果',
        sentence: 'An apple a day.',
        created_at: new Date(),
        updated_at: new Date(),
      })
      await db.table('book_vocabularies').insert({
        book_id: book.id,
        word: 'banana',
        lemma: 'banana',
        frequency: 1,
        meaning: '香蕉',
        sentence: 'A ripe banana.',
        created_at: new Date(),
        updated_at: new Date(),
      })
    } else {
      await BookVocabulary.create({
        bookId: book.id,
        word: 'apple',
        lemma: 'apple',
        frequency: 2,
        sentence: 'An apple a day.',
      })
      await BookVocabulary.create({
        bookId: book.id,
        word: 'banana',
        lemma: 'banana',
        frequency: 1,
        sentence: 'A ripe banana.',
      })
    }

    const response = await client
      .get(`/api/books/${book.id}/vocabulary`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body()[0].word, 'apple')
    assert.isArray(response.body()[0].meanings)
    assert.isArray(response.body()[0].phonetics)
    assert.isNull(response.body()[0].meta)
    assert.isNull(response.body()[0].dictionaryEntryId)
    assert.equal(response.body()[1].word, 'banana')
    assert.isArray(response.body()[1].meanings)
    assert.isArray(response.body()[1].phonetics)
    assert.isNull(response.body()[1].meta)
    assert.isNull(response.body()[1].dictionaryEntryId)
  })

  test('GET /api/books/:id/chapters/:chapterIndex/audio returns mp3 content when the file exists and 404 when it does not', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Books User',
      emailPrefix: 'books',
    })
    const book = await createPublishedBook(user.id, {
      title: 'Audio Chapter Book',
    })

    const audioPath = `book/voices/${book.id}/chapter-0.mp3`
    const storageDir = join(process.cwd(), 'storage', 'book', 'voices', String(book.id))
    const storageFile = join(process.cwd(), 'storage', audioPath)

    cleanup(async () => {
      await rm(storageDir, { recursive: true, force: true })
      await BookChapterAudio.query().where('bookId', book.id).delete()
      await BookChapter.query().where('bookId', book.id).delete()
      await book.delete()
      await user.delete()
    })

    await BookChapter.create({
      bookId: book.id,
      chapterIndex: 0,
      title: 'Chapter 1',
      content: 'Audio chapter content',
    })

    await BookChapterAudio.create({
      bookId: book.id,
      chapterIndex: 0,
      textHash: crypto.randomUUID().replace(/-/g, ''),
      voiceHash: 'default-voice',
      audioPath,
      durationMs: 1234,
      status: 'completed',
      errorMessage: null,
    })

    await mkdir(storageDir, { recursive: true })
    await writeFile(storageFile, Buffer.from('fake-mp3-binary'))

    const successResponse = await client
      .get(`/api/books/${book.id}/chapters/0/audio`)
      .header('Authorization', bearerAuthHeader(token))

    successResponse.assertStatus(200)
    assert.include(successResponse.header('content-type') || '', 'audio/mpeg')

    await rm(storageFile, { force: true })

    const missingFileResponse = await client
      .get(`/api/books/${book.id}/chapters/0/audio`)
      .header('Authorization', bearerAuthHeader(token))

    missingFileResponse.assertStatus(404)
  })
})
