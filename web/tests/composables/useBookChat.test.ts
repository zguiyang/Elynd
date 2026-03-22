import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useBookChat } from '@/composables/useBookChat'

vi.mock('@/api/book-chat', () => ({
  createBookChat: vi.fn(),
}))

vi.mock('@/lib/chat-stream-message', () => ({
  updateAssistantMessageContent: vi.fn(),
}))

import { createBookChat } from '@/api/book-chat'
import { updateAssistantMessageContent } from '@/lib/chat-stream-message'

const getMessages = (exposed: ReturnType<typeof useBookChat>) => {
  const source = exposed.messages as unknown
  if (Array.isArray(source)) {
    return source
  }
  return (source as { value: { role: 'user' | 'assistant'; content: string }[] }).value
}

function mountUseBookChat(bookId = 1) {
  const Harness = defineComponent({
    setup(_, { expose }) {
      const state = useBookChat(bookId)
      expose(state)
      return () => null
    },
  })

  const wrapper = mount(Harness)
  return {
    wrapper,
    exposed: wrapper.vm as unknown as ReturnType<typeof useBookChat>,
  }
}

describe('useBookChat', () => {
  let mockEventSource: { close: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()

    mockEventSource = {
      close: vi.fn(),
    }
    vi.mocked(createBookChat).mockReturnValue(mockEventSource as any)
  })

  it('appends a user message and an empty assistant placeholder', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')

    const messages = getMessages(exposed)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello' })
    expect(messages[1]).toEqual({ role: 'assistant', content: '' })

    wrapper.unmount()
  })

  it('calls createBookChat with the correct payload and enters waiting state', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello', 5)

    expect(createBookChat).toHaveBeenCalledWith(1, expect.objectContaining({
      message: 'Hello',
      chapterIndex: 5,
    }))
    expect(exposed.isLoading).toBe(true)
    expect(exposed.isWaitingForResponse).toBe(true)

    wrapper.unmount()
  })

  it('passes action type to createBookChat when provided', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello', 5, 'qa')

    expect(createBookChat).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        message: 'Hello',
        chapterIndex: 5,
        actionType: 'qa',
      })
    )

    wrapper.unmount()
  })

  it('ends waiting state and updates assistant content on the first chunk', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')

    const call = vi.mocked(createBookChat).mock.calls[0]
    const onChunk = call?.[1].onChunk

    onChunk?.('Hi')

    expect(exposed.isWaitingForResponse).toBe(false)
    expect(updateAssistantMessageContent).toHaveBeenCalledWith(
      exposed.messages,
      1,
      'Hi'
    )

    wrapper.unmount()
  })

  it('finalizes content and resets loading flags on complete', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')

    const call = vi.mocked(createBookChat).mock.calls[0]
    const onComplete = call?.[1].onComplete

    onComplete?.('Full response')

    expect(exposed.isLoading).toBe(false)
    expect(exposed.isWaitingForResponse).toBe(false)
    expect(updateAssistantMessageContent).toHaveBeenLastCalledWith(
      exposed.messages,
      1,
      'Full response'
    )

    wrapper.unmount()
  })

  it('writes a fallback message and resets loading flags on error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')

    const call = vi.mocked(createBookChat).mock.calls[0]
    const onError = call?.[1].onError

    onError?.('Network error')

    expect(exposed.isLoading).toBe(false)
    expect(exposed.isWaitingForResponse).toBe(false)
    expect(updateAssistantMessageContent).toHaveBeenLastCalledWith(
      exposed.messages,
      1,
      '抱歉，请稍后重试'
    )
    expect(errorSpy).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('clearMessages empties messages and closes the active event source', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')
    exposed.clearMessages()

    expect(getMessages(exposed)).toEqual([])
    expect(exposed.isLoading).toBe(false)
    expect(exposed.isWaitingForResponse).toBe(false)
    expect(mockEventSource.close).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('closes the active event source when the host component unmounts', () => {
    const { exposed, wrapper } = mountUseBookChat()

    exposed.sendMessage('Hello')
    wrapper.unmount()

    expect(mockEventSource.close).toHaveBeenCalledTimes(1)
  })
})
