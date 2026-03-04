import { createArticleChat, type ChatMessage } from '@/api/article-chat'

export function useArticleChat(articleId: number) {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const isWaitingForResponse = ref(false)
  const currentStreamingContent = ref('')
  let currentEventSource: { close: () => void } | null = null

  let assistantMessageRef: ChatMessage | null = null

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
    assistantMessageRef = assistantMessage

    isLoading.value = true
    isWaitingForResponse.value = true

    currentEventSource = createArticleChat(articleId, {
      message: content,
      chapterIndex,
      onChunk: (chunk) => {
        if (isWaitingForResponse.value) {
          isWaitingForResponse.value = false
        }

        // 直接显示新内容，实时流式
        currentStreamingContent.value += chunk
        if (assistantMessageRef) {
          assistantMessageRef.content = currentStreamingContent.value
        }
      },
      onComplete: (fullContent) => {
        assistantMessage.content = fullContent
        currentStreamingContent.value = fullContent
        assistantMessageRef = null
        isLoading.value = false
        isWaitingForResponse.value = false
      },
      onError: (error) => {
        assistantMessageRef = null
        assistantMessage.content = '抱歉，请稍后重试'
        isLoading.value = false
        isWaitingForResponse.value = false
        console.error('Chat error:', error)
      },
    })
  }

  const clearMessages = () => {
    messages.value = []
    currentStreamingContent.value = ''
    assistantMessageRef = null
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
