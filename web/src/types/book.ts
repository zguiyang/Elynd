export interface Tag {
  id: number
  name: string
  slug: string
}

export interface BookLevel {
  id: number
  code: string
  name: string
  description: string
  minWords: number | null
  maxWords: number | null
  sortOrder: number
  isActive: boolean
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
  levelId: number
  level: BookLevel
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
  levelId: number
  level: BookLevel
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
  levelId?: number
  tagId?: number
  page?: number
  perPage?: number
}

export interface VocabularyItem {
  id: number
  bookId: number
  dictionaryEntryId: number | null
  word: string
  lemma: string
  frequency: number
  sentence: string
  sourceLanguage: string | null
  localizationLanguage: string | null
  phonetic: string | null
  phonetics: Array<{
    text: string
    audio?: string
  }>
  meanings: Array<{
    partOfSpeech: string
    sourceMeaning: string
    localizedMeaning: string
    plainExplanation: string
    definitions: Array<{
      sourceText: string
      localizedText: string
      plainExplanation: string
      examples: Array<{
        sourceText: string
        localizedText: string
        source: 'dictionary' | 'article' | 'ai'
      }>
    }>
  }>
  articleExamples: Array<{
    sourceText: string
    localizedText: string
    source: 'article' | 'ai'
  }>
  meta: {
    source: 'dictionary'
    localizationLanguage: string
  } | null
}

export type ChapterTranslationStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface ChapterTranslationSentence {
  sentenceIndex: number
  original: string
  translated: string
  sourceOffsets: [number, number] | null
  targetOffsets: [number, number] | null
  tokensMap: Array<{ sourceToken: string; targetToken: string }> | null
}

export interface ChapterTranslationParagraph {
  paragraphIndex: number
  sentences: ChapterTranslationSentence[]
}

export interface ChapterTranslationResult {
  title: {
    original: string
    translated: string
  }
  paragraphs: ChapterTranslationParagraph[]
}

export interface ChapterTranslationResponse {
  status: ChapterTranslationStatus
  translationId: number | null
  data: ChapterTranslationResult | null
}
