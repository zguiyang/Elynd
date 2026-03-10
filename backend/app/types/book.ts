export interface GenerateBookParams {
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

export interface ChapterItem {
  index: number
  title: string
  content: string
}

export interface AiBookResponse {
  title: string
  chapters: ChapterItem[]
  wordCount: number
  tags: Array<{ name: string; isNew: boolean }>
  vocabulary: VocabularyItem[]
}

export interface ParsedBookResponse {
  title: string
  chapters: ChapterItem[]
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
  vocabularyLevel?: string
}

export interface DifficultyConfig {
  maxWords: number
  maxTokens: number
  description: string
}
