import { useAuthStore } from '@/stores/auth'

export interface SseOptions<T = unknown> {
  url: string
  params?: Record<string, string | number>
  signal?: AbortSignal
  onMessage?: (data: T) => void
  onChunk?: (data: T) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: string) => void
}

export interface SseHandle {
  close: () => void
}

export function createSSE<T = unknown>(options: SseOptions<T>): SseHandle {
  const {
    url,
    params = {},
    signal,
    onMessage,
    onChunk,
    onComplete,
    onError
  } = options

  const baseUrl = import.meta.env.VITE_SSE_BASE_URL
  const fullUrl = new URL(`/api${url}`, baseUrl)

  Object.entries(params).forEach(([k, v]) => {
    fullUrl.searchParams.append(k, String(v))
  })

  const authStore = useAuthStore()
  if (authStore.token) {
    fullUrl.searchParams.append('token', authStore.token)
  }

  if (signal?.aborted) {
    return { close: () => {} }
  }

  const eventSource = new EventSource(fullUrl.toString())
  
  let fullContent = ''

  const close = () => {
    eventSource.close()
  }

  if (signal) {
    signal.addEventListener('abort', close, { once: true })
  }

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as T

      onMessage?.(data)

      const messageData = data as Record<string, unknown>
      const type = messageData.type as string | undefined
      
      if (type === 'chunk') {
        const chunkContent = messageData.content as string | undefined
        if (chunkContent) {
          fullContent += chunkContent
        }
        onChunk?.(data)
      } else if (type === 'complete' || type === 'done') {
        close()
        onComplete?.(fullContent)
      } else if (type === 'error') {
        close()
        const errorMessage = messageData.message as string | undefined
        onError?.(errorMessage || 'Unknown error')
      }
    } catch {
      close()
      onError?.('Failed to parse response')
    }
  }

  eventSource.onerror = () => {
    close()
    onError?.('Connection error')
  }

  return { close }
}
