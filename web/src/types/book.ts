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
  audioUrl: string | null
  audioStatus: AudioStatus | null
  audioDurationMs: number | null
}

export interface ChapterListItem {
  id: number
  chapterIndex: number
  title: string
}

export type AudioStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type BookImportRunStatus = 'pending' | 'parsing' | 'processing_chapters' | 'generating_vocabulary' | 'completed' | 'failed'
export type BookImportStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface BookImportStep {
  key: string
  status: BookImportStepStatus
  progress: number
  errorCode?: string
  errorMessage?: string
}

export interface BookImportRun {
  id: number
  bookId: number
  status: BookImportRunStatus
  steps: BookImportStep[]
  currentStep?: string
  totalProgress: number
  errorCode?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface BookStatusResponse {
  id: number
  status: 'processing' | 'ready' | 'failed'
  processingStep: string | null
  processingProgress: number
  processingError: string | null
  audioStatus?: AudioStatus | null
  vocabularyStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null
  latestRun?: {
    id: number
    jobType: string
    status: string
    currentStep: string | null
    progress: number
    startedAt: string | null
    finishedAt: string | null
    errorCode: string | null
    errorMessage: string | null
  } | null
  chapterAudioSummary?: {
    total: number
    completed: number
    pending: number
    failed: number
  }
  vocabularySummary?: {
    total: number
    completed: number
    pending: number
    failed: number
  }
}

export interface Book {
  id: number
  title: string
  source: 'user_uploaded' | 'public_domain'
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
  source: 'user_uploaded' | 'public_domain'
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
