export type ChapterTranslationStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface BilingualSentence {
  sentenceIndex: number
  original: string
  translated: string
  sourceOffsets: [number, number] | null
  targetOffsets: [number, number] | null
  tokensMap: Array<{ sourceToken: string; targetToken: string }> | null
}

export interface BilingualParagraph {
  paragraphIndex: number
  sentences: BilingualSentence[]
}

export interface ChapterTranslationResult {
  title: {
    original: string
    translated: string
  }
  paragraphs: BilingualParagraph[]
}

export interface ChapterTranslationMetadata {
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  modelVersion?: string
  cacheKey?: string
}

export interface RequestChapterTranslationParams {
  chapterId: number
  userId: number
  sourceLanguage: string
  targetLanguage: string
}

export interface ChapterTranslationResponse {
  status: ChapterTranslationStatus
  translationId: number | null
  data: ChapterTranslationResult | null
}
