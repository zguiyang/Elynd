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

  if (signal?.aborted) {
    return { close: () => {} }
  }

  const authStore = useAuthStore()
  const controller = new AbortController()
  let closed = false
  let fullContent = ''

  const close = () => {
    if (closed) return
    closed = true
    controller.abort()
  }

  if (signal) {
    signal.addEventListener('abort', close, { once: true })
  }

  const parseMessage = (rawData: string) => {
    try {
      const data = JSON.parse(rawData) as T

      onMessage?.(data)

      const messageData = data as Record<string, unknown>
      const type = messageData.type as string | undefined

      if (type === 'chunk') {
        const chunkContent = messageData.content as string | undefined
        if (chunkContent) {
          fullContent += chunkContent
        }
        onChunk?.(data)
      } else if (type === 'done') {
        const doneContent = (messageData.content as string | undefined) || fullContent
        close()
        onComplete?.(doneContent)
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

  const parseStreamBuffer = (buffer: string) => {
    let remaining = buffer

    while (true) {
      const boundaryIndex = remaining.indexOf('\n\n')
      if (boundaryIndex < 0) {
        return remaining
      }

      const eventBlock = remaining.slice(0, boundaryIndex)
      remaining = remaining.slice(boundaryIndex + 2)

      const dataLines = eventBlock
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())

      if (dataLines.length > 0) {
        parseMessage(dataLines.join('\n'))
      }
    }
  }

  void (async () => {
    try {
      const response = await fetch(fullUrl.toString(), {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        let message = `Connection failed (${response.status})`
        try {
          const body = await response.json()
          if (typeof body?.message === 'string') {
            message = body.message
          } else if (typeof body?.error === 'string') {
            message = body.error
          }
        } catch {
          // ignore parse failure and keep fallback message
        }
        close()
        onError?.(message)
        return
      }

      if (!response.body) {
        close()
        onError?.('Connection error')
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (!closed) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        buffer = parseStreamBuffer(buffer)
      }

      if (!closed) {
        close()
      }
    } catch {
      if (closed || signal?.aborted) {
        return
      }
      close()
      onError?.('Connection error')
    }
  })()

  return { close }
}
