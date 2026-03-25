import { createSSE } from '@/lib/sse'
import type { SseHandle } from '@/lib/sse'
import { request } from '@/lib/request'
import type { ChapterTranslationStatus, TranslationParagraph, TranslationProgress } from '@/types/book'

interface ChapterTranslationStatusMessage {
  type: 'status' | 'error' | 'paragraph' | 'title' | 'progress'
  translationId?: number
  status?: ChapterTranslationStatus
  errorMessage?: string | null
  message?: string
  paragraphIndex?: number
  sentences?: TranslationParagraph['sentences']
  error?: string
  title?: { original: string; translated: string }
  completedParagraphs?: number
  totalParagraphs?: number
}

interface ChapterTranslationStreamOptions {
  onStatus: (payload: {
    translationId: number
    status: ChapterTranslationStatus
    errorMessage: string | null
  }) => void
  onError: (message: string) => void
  onParagraph?: (payload: {
    paragraphIndex: number
    status: 'completed' | 'failed'
    sentences?: TranslationParagraph['sentences']
    error?: string
  }) => void
  onTitle?: (payload: { original: string; translated: string }) => void
  onProgress?: (payload: { completedParagraphs: number; totalParagraphs: number }) => void
  onChunk?: (data: ChapterTranslationStatusMessage) => void
}

export function createChapterTranslationStream(
  translationId: number,
  options: ChapterTranslationStreamOptions
): SseHandle {
  const { onStatus, onError, onChunk, onParagraph, onTitle, onProgress } = options

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

      if (payload.type === 'paragraph' && typeof payload.paragraphIndex === 'number') {
        if (payload.status === 'completed') {
          onParagraph?.({
            paragraphIndex: payload.paragraphIndex,
            status: 'completed',
            sentences: payload.sentences,
          })
        } else if (payload.status === 'failed') {
          onParagraph?.({
            paragraphIndex: payload.paragraphIndex,
            status: 'failed',
            error: payload.error || payload.message,
          })
        }
        onChunk?.(payload)
        return
      }

      if (payload.type === 'title' && payload.title) {
        onTitle?.(payload.title)
        onChunk?.(payload)
        return
      }

      if (payload.type === 'progress' && typeof payload.completedParagraphs === 'number') {
        onProgress?.({
          completedParagraphs: payload.completedParagraphs,
          totalParagraphs: payload.totalParagraphs || 0,
        })
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
  return request<TranslationProgress>({
    method: 'GET',
    url: `/api/chapter-translations/${translationId}/progress`,
  })
}

export async function retryChapterTranslationParagraph(
  translationId: number,
  paragraphIndex: number
): Promise<{ status: 'queued' | 'processing'; translationId: number; paragraphIndex: number }> {
  return request({
    method: 'POST',
    url: `/api/chapter-translations/${translationId}/paragraphs/${paragraphIndex}/retry`,
  })
}
