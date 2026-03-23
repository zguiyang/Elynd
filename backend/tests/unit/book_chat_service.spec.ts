import { test } from '@japa/runner'
import BookChat from '#models/book_chat'
import { BookChatService } from '#services/book/book_chat_service'
import type { AiClientConfig, AiChatParams, AiStreamHandlers } from '#types/ai'

test.group('BookChatService prompt selection', (group) => {
  const originalBookChatCreate = BookChat.create

  group.each.teardown(() => {
    BookChat.create = originalBookChatCreate
  })

  test('streamChat uses the selection chat prompt when actionType is provided', async ({
    assert,
  }) => {
    let capturedPromptName: string | null = null
    let capturedPromptData: { actionType?: string; selectedText?: string } | null = null
    let capturedUserMessage: string | null = null

    BookChat.create = async function fakeCreate() {
      return {} as typeof BookChat
    } as typeof BookChat.create

    const service = new BookChatService(
      {
        streamChat: async (
          _config: AiClientConfig,
          payload: AiChatParams,
          handlers: AiStreamHandlers
        ) => {
          capturedUserMessage = payload.messages[1]?.content ?? null
          handlers.onComplete({
            content: 'ok',
            usage: {
              promptTokens: 1,
              completionTokens: 1,
              totalTokens: 2,
            },
          })
        },
      } as never,
      {
        getAiConfig: async () => ({
          baseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'test-model',
        }),
      } as never,
      {
        getConfigByUserId: async () => ({
          nativeLanguage: 'zh',
          targetLanguage: 'en',
        }),
      } as never,
      {
        render: (name: string, data: { actionType?: string; selectedText?: string } = {}) => {
          capturedPromptName = name
          capturedPromptData = data
          return `${name}:${JSON.stringify(data)}`
        },
      } as never,
      {
        findReadableBookById: async () => ({
          title: 'Test Book',
        }),
      } as never
    )

    await service.streamChat(
      {
        userId: 1,
        bookId: 2,
        isAdmin: false,
        message: 'were',
        actionType: 'qa',
      },
      {
        onChunk: () => {},
        onComplete: () => {},
        onError: () => {},
      }
    )

    assert.equal(capturedPromptName, 'book/selection-chat')
    assert.equal(capturedPromptData!.actionType, 'qa')
    assert.equal(capturedPromptData!.selectedText, 'were')
    assert.equal(capturedUserMessage, 'were')
  })

  test('streamChat uses the generic book chat prompt when actionType is absent', async ({
    assert,
  }) => {
    let capturedPromptName: string | null = null

    BookChat.create = async function fakeCreate() {
      return {} as typeof BookChat
    } as typeof BookChat.create

    const service = new BookChatService(
      {
        streamChat: async (
          _config: AiClientConfig,
          _payload: AiChatParams,
          handlers: AiStreamHandlers
        ) => {
          handlers.onComplete({
            content: 'ok',
            usage: {
              promptTokens: 1,
              completionTokens: 1,
              totalTokens: 2,
            },
          })
        },
      } as never,
      {
        getAiConfig: async () => ({
          baseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'test-model',
        }),
      } as never,
      {
        getConfigByUserId: async () => ({
          nativeLanguage: 'zh',
          targetLanguage: 'en',
        }),
      } as never,
      {
        render: (name: string) => {
          capturedPromptName = name
          return name
        },
      } as never,
      {
        findReadableBookById: async () => ({
          title: 'Test Book',
        }),
      } as never
    )

    await service.streamChat(
      {
        userId: 1,
        bookId: 2,
        isAdmin: false,
        message: 'Hello',
      },
      {
        onChunk: () => {},
        onComplete: () => {},
        onError: () => {},
      }
    )

    assert.equal(capturedPromptName, 'book/chat')
  })
})
