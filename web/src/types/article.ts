export interface Tag {
  id: number
  name: string
  slug: string
}

export interface Article {
  id: number
  title: string
  content: string
  difficultyLevel: string
  wordCount: number | null
  readingTime: number | null
  tableOfContents: string[] | null
  chapterCount: number | null
  isPublished: boolean
  createdBy: number
  createdAt: string
  updatedAt: string
  tags: Tag[]
}

export interface ArticleListItem {
  id: number
  title: string
  difficultyLevel: string
  wordCount: number | null
  readingTime: number | null
  tableOfContents: string[] | null
  chapterCount: number | null
  createdAt: string
  tags: Tag[]
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
