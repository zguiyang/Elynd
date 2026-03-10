import { request } from '@/lib/request'
import type {
  Book,
  BookListItem,
  BookListParams,
  Chapter,
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

  getVocabulary: (bookId: number) =>
    request<VocabularyItem[]>({ method: 'GET', url: `/api/books/${bookId}/vocabulary` }),
}
