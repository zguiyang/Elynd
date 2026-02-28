export interface GenerateArticleParams {
  difficultyLevel: string
  topic: string
  extraInstructions?: string
}

export interface VocabularyItem {
  word: string
  meaning: string
  sentence: string
  phonetic?: string
}

export interface AiArticleResponse {
  title: string
  tableOfContents: string[] | null
  chapterCount: number
  content: string
  wordCount: number
  tags: Array<{ name: string; isNew: boolean }>
  vocabulary: VocabularyItem[]
}

export interface ParsedArticleResponse {
  title: string
  tableOfContents: string[]
  chapterCount: number
  content: string
  wordCount: number
  tags: Array<{ name: string; isNew: boolean }>
  vocabulary: VocabularyItem[]
}

export interface ListPublishedParams {
  difficulty?: string
  tagId?: number
  page?: number
  perPage?: number
}

export interface UserLanguageConfig {
  nativeLanguage: string
  targetLanguage: string
  englishVariant: string
}

export interface DifficultyConfig {
  maxWords: number
  maxTokens: number
  description: string
}
