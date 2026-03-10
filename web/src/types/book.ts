export interface Tag {
  id: number
  name: string
  slug: string
}

export interface Chapter {
  id: number
  chapterIndex: number
  title: string
  content?: string
}

export interface ChapterListItem {
  id: number
  chapterIndex: number
  title: string
}

export type AudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Book {
  id: number
  title: string
  source: 'user_uploaded' | 'public_domain' | 'ai_generated'
  author: string | null
  description: string | null
  difficultyLevel: string
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
  processingError: string | null
  wordCount: number
  readingTime: number
  isPublished: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
  tags: Tag[]
  chapters: ChapterListItem[]
  audioUrl: string | null
  audioStatus: AudioStatus | null
}

export interface BookListItem {
  id: number
  title: string
  source: 'user_uploaded' | 'public_domain' | 'ai_generated'
  author: string | null
  description: string | null
  difficultyLevel: string
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
  wordCount: number
  readingTime: number
  createdAt: string
  tags: Tag[]
  chapters: ChapterListItem[]
}

export interface PaginationMeta {
  currentPage: number
  perPage: number
  lastPage: number
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface BookListParams {
  difficulty?: 'L1' | 'L2' | 'L3'
  tagId?: number
  page?: number
  perPage?: number
}

export interface VocabularyItem {
  id: number
  bookId: number
  word: string
  lemma: string
  frequency: number
  meaning: string
  sentence: string
  phonetic: string | null
  phoneticText: string | null
  phoneticAudio: string | null
  details: {
    meanings: Array<{
      partOfSpeech: string
      definitions: Array<{
        definition: string
        example?: string
      }>
    }>
  } | null
}
