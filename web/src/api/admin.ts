import { request } from '@/lib/request'
import type { BookStatusResponse } from '@/types/book'

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

export interface ParsedBookChapter {
  chapterIndex: number
  title: string
  content: string
  wordCount: number
}

export interface ParsedBookPreview {
  fileName: string
  title: string
  author: string | null
  description: string | null
  chapters: ParsedBookChapter[]
  wordCount: number
}

export interface ImportBookPayload {
  title: string
  author?: string
  description?: string
  source: 'user_uploaded' | 'public_domain' | 'ai_generated'
  difficultyLevel: 'L1' | 'L2' | 'L3'
  wordCount: number
  chapters: Array<{ title: string; content: string }>
}

export interface ImportBookResponse {
  bookId: number
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
}

export const adminApi = {
  generateBook: (data: GenerateBookData) =>
    request<GenerateBookResponse>({ method: 'POST', url: '/api/admin/books/generate', data }),

  parseBookFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    return request<ParsedBookPreview>({
      method: 'POST',
      url: '/api/admin/books/parse',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  importBook: (data: ImportBookPayload) =>
    request<ImportBookResponse>({ method: 'POST', url: '/api/admin/books/import', data }),

  getBookStatus: (id: number) =>
    request<BookStatusResponse>({ method: 'GET', url: `/api/admin/books/${id}/status` }),

  getSystemConfig: () =>
    request<SystemConfig>({ method: 'GET', url: '/api/admin/system-config' }),

  updateSystemConfig: (data: SystemConfig) =>
    request<SystemConfig>({ method: 'PUT', url: '/api/admin/system-config', data }),
}
