import { createArticleChat, type ChatMessage } from '@/api/article-chat'

const TYPEWRITER_DELAY = 30

export function useArticleChat(articleId: number) {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const isWaitingForResponse = ref(false)
  const currentStreamingContent = ref('')
  let currentEventSource: { close: () => void } | null = null
  let typewriterTimer: ReturnType<typeof setTimeout> | null = null

  const sendMessage = (content: string, chapterIndex?: number) => {
    if (isLoading.value) return

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

    isLoading.value = true
    isWaitingForResponse.value = true
    currentStreamingContent.value = ''

    currentEventSource = createArticleChat(articleId, {
      message: content,
      chapterIndex,
      onChunk: (chunk) => {
        if (isWaitingForResponse.value) {
          isWaitingForResponse.value = false
        }
        currentStreamingContent.value += chunk
        assistantMessage.content = currentStreamingContent.value
      },
      onComplete: (fullContent) => {
        assistantMessage.content = fullContent
        isLoading.value = false
        isWaitingForResponse.value = false
        currentStreamingContent.value = ''
      },
      onError: (error) => {
        assistantMessage.content = '抱歉，请稍后重试'
        isLoading.value = false
        isWaitingForResponse.value = false
        currentStreamingContent.value = ''
        console.error('Chat error:', error)
      },
    })
  }

  const startTypewriter = (messageIndex: number) => {
    if (typewriterTimer) {
      clearTimeout(typewriterTimer)
    }

    const message = messages.value[messageIndex]
    if (!message || message.role !== 'assistant') return

    message.content = ''
    let charIndex = 0

    const typeNextChar = () => {
      if (charIndex < currentStreamingContent.value.length) {
        message.content += currentStreamingContent.value[charIndex]
        charIndex++
        typewriterTimer = setTimeout(typeNextChar, TYPEWRITER_DELAY)
      }
    }

    typeNextChar()
  }

  watch(currentStreamingContent, (_newContent) => {
    const lastMessageIndex = messages.value.length - 1
    if (lastMessageIndex >= 0 && isLoading.value) {
      const lastMessage = messages.value[lastMessageIndex]
      if (lastMessage.role === 'assistant') {
        if (!typewriterTimer) {
          startTypewriter(lastMessageIndex)
        }
      }
    }
  })

  const clearMessages = () => {
    messages.value = []
    currentStreamingContent.value = ''
    isWaitingForResponse.value = false
    if (currentEventSource) {
      currentEventSource.close()
      currentEventSource = null
    }
    if (typewriterTimer) {
      clearTimeout(typewriterTimer)
      typewriterTimer = null
    }
  }

  onUnmounted(() => {
    if (currentEventSource) {
      currentEventSource.close()
    }
    if (typewriterTimer) {
      clearTimeout(typewriterTimer)
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
