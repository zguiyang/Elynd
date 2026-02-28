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

export interface Article {
  id: number
  title: string
  difficultyLevel: string
  wordCount: number
  readingTime: number
  isPublished: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
  tags: Tag[]
  chapters: ChapterListItem[]
}

export interface ArticleListItem {
  id: number
  title: string
  difficultyLevel: string
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

export interface ArticleListParams {
  difficulty?: 'L1' | 'L2' | 'L3'
  tagId?: number
  page?: number
  perPage?: number
}

export interface VocabularyItem {
  id: number
  articleId: number
  word: string
  meaning: string
  sentence: string
  phonetic: string | null
}
