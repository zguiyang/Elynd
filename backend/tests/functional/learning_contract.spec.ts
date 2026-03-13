import { test } from '@japa/runner'
import crypto from 'node:crypto'
import Book from '#models/book'
import Tag from '#models/tag'
import LearningRecord from '#models/learning_record'
import BookReadProgress from '#models/book_read_progress'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

async function createPublishedBook(attributes?: Partial<Book>) {
  return await Book.create({
    title: `Book ${crypto.randomUUID()}`,
    author: 'Test Author',
    source: 'user_uploaded',
    difficultyLevel: 'L1',
    status: 'ready',
    wordCount: 1200,
    readingTime: 6,
    isPublished: true,
    createdBy: 1,
    contentHash: crypto.randomUUID(),
    description: 'Default description',
    ...attributes,
  })
}

test.group('Learning API contract', () => {
  test('POST /api/learning/login increments learning days only on the first login of the day', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Learning User',
      emailPrefix: 'learning',
    })
    cleanup(async () => {
      await LearningRecord.query().where('userId', user.id).delete()
      await user.delete()
    })

    const firstResponse = await client
      .post('/api/learning/login')
      .header('Authorization', bearerAuthHeader(token))

    firstResponse.assertStatus(200)
    assert.equal(firstResponse.body().learningDays, 1)
    assert.isTrue(firstResponse.body().isFirstLoginToday)

    const secondResponse = await client
      .post('/api/learning/login')
      .header('Authorization', bearerAuthHeader(token))

    secondResponse.assertStatus(200)
    assert.equal(secondResponse.body().learningDays, 1)
    assert.isFalse(secondResponse.body().isFirstLoginToday)
  })

  test('PUT /api/learning/progress creates and then updates the same progress record', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Learning User',
      emailPrefix: 'learning',
    })
    const book = await createPublishedBook({ createdBy: user.id })

    cleanup(async () => {
      await BookReadProgress.query().where('userId', user.id).delete()
      await book.delete()
      await user.delete()
    })

    const createResponse = await client
      .put('/api/learning/progress')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        bookId: book.id,
        progress: 25,
      })

    createResponse.assertStatus(200)
    assert.equal(createResponse.body().bookId, book.id)
    assert.equal(createResponse.body().progress, 25)

    const updateResponse = await client
      .put('/api/learning/progress')
      .header('Authorization', bearerAuthHeader(token))
      .json({
        bookId: book.id,
        progress: 80,
      })

    updateResponse.assertStatus(200)
    assert.equal(updateResponse.body().bookId, book.id)
    assert.equal(updateResponse.body().progress, 80)

    const progressRecords = await BookReadProgress.query()
      .where('userId', user.id)
      .where('bookId', book.id)

    assert.lengthOf(progressRecords, 1)
    assert.equal(progressRecords[0]?.progress, 80)
  })

  test('GET /api/learning/index returns learning stats, continue reading items, and recommendations with descriptions', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Learning User',
      emailPrefix: 'learning',
    })
    const tag = await Tag.create({
      name: `Tag ${crypto.randomUUID()}`,
      slug: `tag-${crypto.randomUUID()}`,
    })

    const readingBook = await createPublishedBook({
      createdBy: user.id,
      title: 'Reading Book',
      difficultyLevel: 'L1',
      description: 'Reading description',
    })

    const recommendedBook = await createPublishedBook({
      createdBy: user.id,
      title: 'Recommended Book',
      difficultyLevel: 'L2',
      description: 'Recommended description',
    })

    cleanup(async () => {
      await BookReadProgress.query().where('userId', user.id).delete()
      await LearningRecord.query().where('userId', user.id).delete()
      await readingBook.related('tags').detach([tag.id])
      await recommendedBook.related('tags').detach([tag.id])
      await recommendedBook.delete()
      await readingBook.delete()
      await tag.delete()
      await user.delete()
    })

    await readingBook.related('tags').attach([tag.id])
    await recommendedBook.related('tags').attach([tag.id])

    await LearningRecord.create({
      userId: user.id,
      learningDays: 3,
      date: '2026-03-11',
    })

    await BookReadProgress.create({
      userId: user.id,
      bookId: readingBook.id,
      progress: 40,
    })

    const response = await client
      .get('/api/learning/index')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.learningDays, 4)
    assert.equal(body.booksReadCount, 1)
    assert.lengthOf(body.continueReading, 1)
    assert.equal(body.continueReading[0].id, readingBook.id)
    assert.equal(body.continueReading[0].category, tag.name)
    assert.equal(body.continueReading[0].progress, 40)

    const recommendedItem = body.recommendedBooks.find(
      (item: { id: number }) => item.id === recommendedBook.id
    )

    assert.exists(recommendedItem)
    assert.equal(recommendedItem.category, tag.name)
    assert.equal(recommendedItem.description, 'Recommended description')
  })
})
