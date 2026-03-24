import { createSSE } from '@/lib/sse'
import type { SseHandle } from '@/lib/sse'
import { request } from '@/lib/request'
import type { ChapterTranslationStatus, TranslationParagraph, TranslationProgress } from '@/types/book'

interface ChapterTranslationStatusMessage {
  type: 'status' | 'error' | 'paragraph'
  translationId?: number
  status?: ChapterTranslationStatus
  errorMessage?: string | null
  message?: string
  paragraphIndex?: number
  sentences?: TranslationParagraph['sentences']
}

interface ChapterTranslationStreamOptions {
  onStatus: (payload: {
    translationId: number
    status: ChapterTranslationStatus
    errorMessage: string | null
  }) => void
  onError: (message: string) => void
  onChunk?: (data: ChapterTranslationStatusMessage) => void
}

export function createChapterTranslationStream(
  translationId: number,
  options: ChapterTranslationStreamOptions
): SseHandle {
  const { onStatus, onError, onChunk } = options

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

      if (payload.type === 'paragraph') {
        const messageData = payload as Record<string, unknown>
        const paragraph: TranslationParagraph = {
          paragraphIndex: messageData.paragraphIndex as number,
          sentences: messageData.sentences as TranslationParagraph['sentences'],
        }
        onChunk?.(payload)
        return
      }

      if (payload.type === 'error') {
        onError(payload.message || 'Translation stream failed')
      }
    },
    onError: (message) => {
      onError(message)
    },
    onChunk,
  })
}

export async function getChapterTranslationProgress(translationId: number): Promise<TranslationProgress> {
  const { data } = await request<TranslationProgress>({
    method: 'GET',
    url: `/api/chapter-translations/${translationId}/progress`,
  })
  return data
}
