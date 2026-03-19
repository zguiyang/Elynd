import { request } from '@/lib/request'
import type {
  Book,
  BookListItem,
  BookListParams,
  Chapter,
  ChapterTranslationResponse,
  PaginatedResponse,
  Tag,
  VocabularyItem,
} from '@/types/book'

export const bookApi = {
  list: (params?: BookListParams) =>
    request<PaginatedResponse<BookListItem>>({ method: 'GET', url: '/api/books', params }),

  getById: (id: number) =>
    request<Book>({ method: 'GET', url: `/api/books/${id}` }),

  getChapter: (bookId: number, chapterIndex: number) =>
    request<Chapter>({ method: 'GET', url: `/api/books/${bookId}/chapters/${chapterIndex}` }),

  getTags: () =>
    request<Tag[]>({ method: 'GET', url: '/api/tags' }),

  getLevels: () =>
    request<Book['level'][]>({ method: 'GET', url: '/api/book-levels' }),

  getVocabulary: (bookId: number) =>
    request<VocabularyItem[]>({ method: 'GET', url: `/api/books/${bookId}/vocabulary` }),

  triggerChapterTranslation: (
    chapterId: number,
    data: {
      sourceLanguage: string
      targetLanguage: string
    }
  ) =>
    request<ChapterTranslationResponse>({
      method: 'POST',
      url: `/api/chapters/${chapterId}/translations`,
      data,
    }),

  getChapterTranslation: (
    chapterId: number,
    params: {
      sourceLanguage: string
      targetLanguage: string
    }
  ) =>
    request<ChapterTranslationResponse>({
      method: 'GET',
      url: `/api/chapters/${chapterId}/translations`,
      params,
    }),

  getChapterTranslationStatus: (translationId: number) =>
    request<{
      translationId: number
      status: 'queued' | 'processing' | 'completed' | 'failed'
      errorMessage: string | null
    }>({
      method: 'GET',
      url: `/api/chapter-translations/${translationId}/status`,
    }),
}
