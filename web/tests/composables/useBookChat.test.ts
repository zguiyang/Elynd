import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookChat } from '@/composables/useBookChat'

// Mock API
vi.mock('@/api/book-chat', () => ({
  createBookChat: vi.fn()
}))

vi.mock('@/lib/chat-stream-message', () => ({
  updateAssistantMessageContent: vi.fn()
}))

import { createBookChat } from '@/api/book-chat'
import { updateAssistantMessageContent } from '@/lib/chat-stream-message'

describe('useBookChat', () => {
  let mockEventSource: { close: vi.Mock }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockEventSource = {
      close: vi.fn()
    }
    vi.mocked(createBookChat).mockReturnValue(mockEventSource as any)
  })

  describe('sendMessage', () => {
    it('should append a user message and an empty assistant placeholder', () => {
      const { messages, sendMessage } = useBookChat(1)

      sendMessage('Hello')

      expect(messages.value).toHaveLength(2)
      expect(messages.value[0]).toEqual({ role: 'user', content: 'Hello' })
      expect(messages.value[1]).toEqual({ role: 'assistant', content: '' })
    })

    it('should set isWaitingForResponse to true when sending message', () => {
      const { isWaitingForResponse, sendMessage } = useBookChat(1)

      sendMessage('Hello')

      expect(isWaitingForResponse.value).toBe(true)
    })

    it('should call createBookChat with correct parameters', () => {
      const { sendMessage } = useBookChat(1)

      sendMessage('Hello', 5)

      expect(createBookChat).toHaveBeenCalledWith(1, expect.objectContaining({
        message: 'Hello',
        chapterIndex: 5,
      }))
    })

    it('should end waiting state and update content on first chunk', () => {
      const { isWaitingForResponse, sendMessage } = useBookChat(1)

      sendMessage('Hello')

      // Get the onChunk callback
      const call = vi.mocked(createBookChat).mock.calls[0]
      const onChunk = (call[1] as any).onChunk

      // Simulate first chunk
      onChunk('Hi')

      expect(isWaitingForResponse.value).toBe(false)
      expect(updateAssistantMessageContent).toHaveBeenCalled()
    })

    it('should finalize content and reset loading flags on complete', () => {
      const { isLoading, isWaitingForResponse, sendMessage } = useBookChat(1)

      sendMessage('Hello')

      // Get the onComplete callback
      const call = vi.mocked(createBookChat).mock.calls[0]
      const onComplete = (call[1] as any).onComplete

      // Simulate completion
      onComplete('Full response')

      expect(isLoading.value).toBe(false)
      expect(isWaitingForResponse.value).toBe(false)
      expect(updateAssistantMessageContent).toHaveBeenCalled()
    })

    it('should write fallback message and reset loading flags on error', () => {
      const { isLoading, isWaitingForResponse, sendMessage } = useBookChat(1)

      sendMessage('Hello')

      // Get the onError callback
      const call = vi.mocked(createBookChat).mock.calls[0]
      const onError = (call[1] as any).onError

      // Simulate error
      onError(new Error('Network error'))

      expect(isLoading.value).toBe(false)
      expect(isWaitingForResponse.value).toBe(false)
      expect(updateAssistantMessageContent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        '抱歉，请稍后重试'
      )
    })
  })

  describe('clearMessages', () => {
    it('should empty messages and close the event source', () => {
      const { messages, sendMessage, clearMessages } = useBookChat(1)

      sendMessage('Hello')
      expect(messages.value.length).toBeGreaterThan(0)

      clearMessages()

      expect(messages.value).toEqual([])
      expect(mockEventSource.close).toHaveBeenCalled()
    })

    it('should reset loading states', () => {
      const { isWaitingForResponse, sendMessage, clearMessages } = useBookChat(1)

      sendMessage('Hello')
      expect(isWaitingForResponse.value).toBe(true)

      clearMessages()

      expect(isWaitingForResponse.value).toBe(false)
    })
  })
})
