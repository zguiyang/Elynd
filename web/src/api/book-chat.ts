import { createSSE  } from '@/lib/sse'
import type {SseHandle} from '@/lib/sse';

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

interface ChatChunkData {
  type: 'chunk' | 'done' | 'error'
  content?: string
  message?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export function createBookChat(bookId: number, options: ChatOptions): SseHandle {
  const { message, chapterIndex, onChunk, onComplete, onError } = options

  return createSSE<ChatChunkData>({
    url: `/books/${bookId}/chats`,
    params: {
      message,
      ...(chapterIndex !== undefined && { chapterIndex }),
    },
    onChunk: (data) => {
      if (data.type === 'chunk' && data.content) {
        onChunk(data.content)
      }
    },
    onComplete: (fullContent) => {
      onComplete(fullContent)
    },
    onError: (error) => {
      onError(error)
    },
  })
}
