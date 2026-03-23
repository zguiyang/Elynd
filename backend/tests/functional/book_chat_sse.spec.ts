import { test } from '@japa/runner'
import crypto from 'node:crypto'
import Book from '#models/book'
import type { ChatParams, StreamHandlers } from '#services/book/book_chat_service'
import { BookChatService } from '#services/book/book_chat_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

test.group('Book Chat SSE API', () => {
  test('GET /api/books/:id/chats responds as text/event-stream and emits chunk/done events', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'SSE Test User',
      emailPrefix: 'sse',
    })
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'SSE Test Book',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 1200,
      readingTime: 8,
      isPublished: true,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await book.delete()
    })

    let capturedParams: ChatParams | null = null

    const originalStreamChat = BookChatService.prototype.streamChat
    BookChatService.prototype.streamChat = async function fakeStreamChat(
      params: ChatParams,
      handlers: StreamHandlers
    ) {
      capturedParams = params
      handlers.onChunk({ delta: 'Hello', isComplete: false })
      handlers.onComplete({
        content: 'Hello world',
        usage: {
          promptTokens: 10,
          completionTokens: 2,
          totalTokens: 12,
        },
      })
    }
    cleanup(() => {
      BookChatService.prototype.streamChat = originalStreamChat
    })

    const response = await client
      .get(`/api/books/${book.id}/chats`)
      .qs({ message: 'were', actionType: 'qa' })
      .header('Authorization', bearerAuthHeader(token))

    assert.equal(response.status(), 200, 'Response should return 200 OK')
    assert.include(
      response.header('content-type') || '',
      'text/event-stream',
      'Response should be served as SSE'
    )
    assert.include(response.text(), ': connected', 'Response should start the SSE stream')
    assert.include(
      response.text(),
      'data: {"type":"chunk","content":"Hello"}',
      'Response should emit a chunk event'
    )
    assert.include(
      response.text(),
      'data: {"type":"done","content":"Hello world","usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12}}',
      'Response should emit a done event'
    )
    assert.equal(capturedParams!.message, 'were')
    assert.equal(capturedParams!.actionType, 'qa')
  })

  test('GET /api/books/:id/chats forbids non-admin user to read unpublished books', async ({
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'SSE Restricted User',
      emailPrefix: 'sse-restricted',
    })
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'SSE Unpublished Book',
      author: 'Test Author',
      source: 'user_uploaded',
      levelId: 2,
      status: 'ready',
      wordCount: 1200,
      readingTime: 8,
      isPublished: false,
      createdBy: user.id,
      contentHash: crypto.randomUUID(),
    })
    cleanup(async () => {
      await book.delete()
    })

    const response = await client
      .get(`/api/books/${book.id}/chats`)
      .qs({ message: 'Explain this chapter' })
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(404)
  })
})
