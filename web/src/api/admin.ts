import { request } from '@/lib/request'
import type { BookStatusResponse } from '@/types/book'

export interface ChapterAudioSummary {
  total: number
  completed: number
  pending: number
  failed: number
}

export interface AdminBook {
  id: number
  title: string
  author: string | null
  description: string | null
  source: 'user_uploaded' | 'public_domain' | 'ai_generated'
  difficultyLevel: string
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
  processingError: string | null
  audioStatus: 'pending' | 'processing' | 'completed' | 'failed' | null
  chapterAudioSummary: ChapterAudioSummary
  vocabularyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null
  vocabularySummary?: {
    total: number
    completed: number
    pending: number
    failed: number
  }
  createdAt: string
  updatedAt: string
}

export interface AdminBooksListResponse {
  data: AdminBook[]
  meta: {
    currentPage: number
    perPage: number
    total: number
    lastPage: number
  }
}

export interface AdminUpdateBookPayload {
  title?: string
  author?: string
  description?: string
  difficultyLevel?: 'L1' | 'L2' | 'L3'
  source?: 'user_uploaded' | 'public_domain' | 'ai_generated'
}

export interface GenerateBookData {
  difficultyLevel: 'L1' | 'L2' | 'L3'
  topic: string
  extraInstructions?: string
}

export interface GenerateBookResponse {
  jobId: string
  status: 'queued'
}

export interface SystemConfig {
  aiBaseUrl: string
  aiApiKey: string
  aiModelName: string
}

export interface ImportBookPayload {
  file: File
  source: 'user_uploaded' | 'public_domain' | 'ai_generated'
  bookHash: string
}

export interface ImportBookResponse {
  bookId: number
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
}

export interface RetryVocabularyResponse {
  success: boolean
  message: string
  vocabularyStatus: string
}

export interface RetryAudioResponse {
  success: boolean
  message: string
  status: string
}

export interface RebuildChaptersResponse {
  success: boolean
  message: string
}

export interface StopImportResponse {
  success: boolean
  message: string
  bookId: number
  runId: number | null
  status: 'stopped'
  removedQueuedJobs: number
}

export interface ContinueImportResponse {
  success: boolean
  message: string
  bookId: number
  runId: number
  status: 'queued'
  jobId: string
  resumeStep: string
}

export const adminApi = {
  generateBook: (data: GenerateBookData) =>
    request<GenerateBookResponse>({ method: 'POST', url: '/api/admin/books/generate', data }),

  retryAudio: (bookId: number) =>
    request<RetryAudioResponse>({ method: 'POST', url: `/api/admin/books/${bookId}/retry-audio` }),

  retryVocabulary: (bookId: number) =>
    request<RetryVocabularyResponse>({ method: 'POST', url: `/api/admin/books/${bookId}/retry-vocabulary` }),

  rebuildChapters: (bookId: number) =>
    request<RebuildChaptersResponse>({ method: 'POST', url: `/api/admin/books/${bookId}/rebuild-chapters` }),

  stopImport: (bookId: number) =>
    request<StopImportResponse>({ method: 'POST', url: `/api/admin/books/${bookId}/stop-import` }),

  continueImport: (bookId: number) =>
    request<ContinueImportResponse>({
      method: 'POST',
      url: `/api/admin/books/${bookId}/continue-import`,
    }),

  importBook: (data: ImportBookPayload) => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('bookHash', data.bookHash)
    formData.append('source', data.source)
    return request<ImportBookResponse>({
      method: 'POST',
      url: '/api/admin/books/import',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },

  getBookStatus: (id: number) =>
    request<BookStatusResponse>({ method: 'GET', url: `/api/admin/books/${id}/status` }),

  getSystemConfig: () =>
    request<SystemConfig>({ method: 'GET', url: '/api/admin/system-config' }),

  updateSystemConfig: (data: SystemConfig) =>
    request<SystemConfig>({ method: 'PUT', url: '/api/admin/system-config', data }),

  listBooks: (params?: { page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', String(params.page))
    if (params?.perPage) searchParams.set('perPage', String(params.perPage))
    const query = searchParams.toString()
    return request<AdminBooksListResponse>({
      method: 'GET',
      url: `/api/admin/books${query ? `?${query}` : ''}`,
    })
  },

  updateBook: (id: number, data: AdminUpdateBookPayload) =>
    request<AdminBook>({ method: 'PATCH', url: `/api/admin/books/${id}`, data }),

  deleteBook: (id: number) =>
    request<{ success: boolean }>({ method: 'DELETE', url: `/api/admin/books/${id}` }),
}
