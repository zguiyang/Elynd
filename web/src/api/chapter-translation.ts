import { createSSE } from '@/lib/sse'
import type { SseHandle } from '@/lib/sse'
import type { ChapterTranslationStatus } from '@/types/book'

interface ChapterTranslationStatusMessage {
  type: 'status' | 'error'
  translationId?: number
  status?: ChapterTranslationStatus
  errorMessage?: string | null
  message?: string
}

interface ChapterTranslationStreamOptions {
  onStatus: (payload: {
    translationId: number
    status: ChapterTranslationStatus
    errorMessage: string | null
  }) => void
  onError: (message: string) => void
}

export function createChapterTranslationStream(
  translationId: number,
  options: ChapterTranslationStreamOptions
): SseHandle {
  const { onStatus, onError } = options

  return createSSE<ChapterTranslationStatusMessage>({
    url: `/chapter-translations/${translationId}/events`,
    onMessage: (payload) => {
      if (payload.type === 'status' && payload.translationId && payload.status) {
        onStatus({
          translationId: payload.translationId,
          status: payload.status,
          errorMessage: payload.errorMessage ?? null,
        })
        return
      }

      if (payload.type === 'error') {
        onError(payload.message || 'Translation stream failed')
      }
    },
    onError: (message) => {
      onError(message)
    },
  })
}
