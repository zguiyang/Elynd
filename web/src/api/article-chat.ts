import { useAuthStore } from '@/stores/auth'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  message: string
  chapterIndex?: number
  onChunk: (content: string) => void
  onComplete: (fullContent: string) => void
  onError: (error: string) => void
}

export function createArticleChat(articleId: number, options: ChatOptions) {
  const { message, chapterIndex, onChunk, onComplete, onError } = options

  const url = new URL(`/api/articles/${articleId}/chats`, import.meta.env.VITE_API_BASE_URL)
  url.searchParams.append('message', message)
  if (chapterIndex !== undefined) {
    url.searchParams.append('chapterIndex', chapterIndex.toString())
  }

  const authStore = useAuthStore()
  if (authStore.token) {
    url.searchParams.append('token', authStore.token)
  }

  const eventSource = new EventSource(url.toString())

  let fullContent = ''

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'chunk') {
        fullContent += data.content
        onChunk(data.content)
      } else if (data.type === 'complete' || data.type === 'done') {
        eventSource.close()
        onComplete(fullContent)
      } else if (data.type === 'error') {
        eventSource.close()
        onError(data.message)
      }
    } catch {
      eventSource.close()
      onError('Failed to parse response')
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
    onError('Connection error')
  }

  return {
    close: () => eventSource.close(),
  }
}
