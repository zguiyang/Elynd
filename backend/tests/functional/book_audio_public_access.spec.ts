import { test } from '@japa/runner'
import crypto from 'node:crypto'
import Book from '#models/book'
import drive from '@adonisjs/drive/services/main'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('GET /audio/books/:id access contract', () => {
  test('未登录访问返回 401', async ({ client }) => {
    const response = await client.get('/audio/books/999999')

    response.assertStatus(401)
    response.assertBodyContains({ error: true, message: 'Unauthenticated' })
  })

  test('普通用户访问未发布书籍音频返回 404', async ({ client, cleanup }) => {
    const { user, token } = await createAuthenticatedUser({ emailPrefix: 'audio-auth-missing' })

    const book = await Book.create({
      title: `Audio Book Missing File ${crypto.randomUUID()}`,
      author: null,
      description: null,
      source: 'user_uploaded',
      levelId: 1,
      status: 'ready',
      wordCount: 100,
      readingTime: 1,
      isPublished: false,
      createdBy: user.id,
    })

    cleanup(async () => {
      await book.delete()
      await user.delete()
    })

    const response = await client
      .get(`/audio/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
    response.assertBodyContains({ error: true, message: 'Book not found' })
  })

  test('已登录访问已发布书籍且文件存在返回 200 + audio/mpeg', async ({ client, cleanup }) => {
    const { user, token } = await createAuthenticatedUser({ emailPrefix: 'audio-auth-ok' })

    const book = await Book.create({
      title: `Audio Book With File ${crypto.randomUUID()}`,
      author: null,
      description: null,
      source: 'user_uploaded',
      levelId: 1,
      status: 'ready',
      wordCount: 100,
      readingTime: 1,
      isPublished: true,
      createdBy: user.id,
    })

    const filePath = `book/voices/${book.id}.mp3`
    await drive.use().put(filePath, Buffer.from('fake-audio-data'))

    cleanup(async () => {
      await drive.use().delete(filePath)
      await book.delete()
      await user.delete()
    })

    const response = await client
      .get(`/audio/books/${book.id}`)
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    response.assertHeader('content-type', 'audio/mpeg')
  })
})
