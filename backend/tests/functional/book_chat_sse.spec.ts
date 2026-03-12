import { test } from '@japa/runner'
import crypto from 'node:crypto'
import Book from '#models/book'
import User from '#models/user'
import { BookChatService } from '#services/book_chat_service'

async function createAuthenticatedUser(): Promise<{ user: User; token: string }> {
  const user = await User.create({
    fullName: 'SSE Test User',
    email: `sse-${crypto.randomUUID()}@example.com`,
    password: 'testpassword123',
    isAdmin: false,
  })

  const token = await User.accessTokens.create(user, ['*'], { expiresIn: '1 day' })

  return { user, token: token.value!.release() }
}

test.group('Book Chat SSE API', () => {
  test('GET /api/books/:id/chats responds as text/event-stream and emits chunk/done events', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser()
    cleanup(async () => {
      await user.delete()
    })

    const book = await Book.create({
      title: 'SSE Test Book',
      author: 'Test Author',
      source: 'user_uploaded',
      difficultyLevel: 'intermediate',
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

    const originalStreamChat = BookChatService.prototype.streamChat
    BookChatService.prototype.streamChat = async function fakeStreamChat(_params, handlers) {
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
      .qs({ message: 'Explain this chapter' })
      .header('Authorization', `Bearer ${token}`)

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
  })
})
