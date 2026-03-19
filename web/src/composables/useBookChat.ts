import { createBookChat  } from '@/api/book-chat'
import type {ChatMessage} from '@/api/book-chat';
import { updateAssistantMessageContent } from '@/lib/chat-stream-message'
import type { ComputedRef, Ref } from 'vue'

type MaybeBookId = number | Ref<number> | ComputedRef<number> | (() => number)

const resolveBookId = (bookId: MaybeBookId) => {
  if (typeof bookId === 'function') {
    return bookId()
  }
  if (typeof bookId === 'number') {
    return bookId
  }
  return bookId.value
}

export function useBookChat(bookId: MaybeBookId) {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const isWaitingForResponse = ref(false)
  const currentStreamingContent = ref('')
  let currentEventSource: { close: () => void } | null = null

  let assistantMessageIndex: number | null = null

  const sendMessage = (content: string, chapterIndex?: number) => {
    if (isLoading.value) return

    currentStreamingContent.value = ''

    const userMessage: ChatMessage = {
      role: 'user',
      content,
    }
    messages.value.push(userMessage)

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
    }
    messages.value.push(assistantMessage)
    assistantMessageIndex = messages.value.length - 1

    isLoading.value = true
    isWaitingForResponse.value = true

    currentEventSource = createBookChat(resolveBookId(bookId), {
      message: content,
      chapterIndex,
      onChunk: (chunk) => {
        if (isWaitingForResponse.value) {
          isWaitingForResponse.value = false
        }

        // 直接显示新内容，实时流式
        currentStreamingContent.value += chunk
        updateAssistantMessageContent(
          messages.value,
          assistantMessageIndex,
          currentStreamingContent.value
        )
      },
      onComplete: (fullContent) => {
        updateAssistantMessageContent(messages.value, assistantMessageIndex, fullContent)
        currentStreamingContent.value = fullContent
        assistantMessageIndex = null
        isLoading.value = false
        isWaitingForResponse.value = false
      },
      onError: (error) => {
        updateAssistantMessageContent(messages.value, assistantMessageIndex, '抱歉，请稍后重试')
        assistantMessageIndex = null
        isLoading.value = false
        isWaitingForResponse.value = false
        console.error('Chat error:', error)
      },
    })
  }

  const clearMessages = () => {
    messages.value = []
    currentStreamingContent.value = ''
    assistantMessageIndex = null
    isWaitingForResponse.value = false
    if (currentEventSource) {
      currentEventSource.close()
      currentEventSource = null
    }
  }

  onUnmounted(() => {
    if (currentEventSource) {
      currentEventSource.close()
    }
  })

  return {
    messages,
    isLoading,
    isWaitingForResponse,
    sendMessage,
    clearMessages,
  }
}
