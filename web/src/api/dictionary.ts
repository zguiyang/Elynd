import { request } from '@/lib/request'

export interface DictionaryLookupContext {
  bookId?: number
  chapterIndex?: number
}

export interface DictionaryDefinition {
  sourceText: string
  localizedText: string
  plainExplanation: string
  examples: DictionaryExample[]
}

export interface DictionaryExample {
  sourceText: string
  localizedText?: string | null
  source: 'dictionary' | 'article' | 'ai'
}

export interface DictionaryMeaning {
  partOfSpeech: string
  sourceMeaning: string
  localizedMeaning: string
  plainExplanation: string
  definitions: DictionaryDefinition[]
}

export interface DictionaryPhonetic {
  text?: string
  audio?: string
}

export interface DictionaryEntry {
  word: string
  sourceLanguage: string
  localizationLanguage: string
  phonetic?: string | null
  phonetics: DictionaryPhonetic[]
  meanings: DictionaryMeaning[]
  articleExamples: DictionaryExample[]
  meta?: {
    source: 'dictionary' | 'dictionary_plus_ai' | 'ai_fallback'
    localizationLanguage: string
  } | null
}

export interface DictionaryLookupError {
  status: number | null
  message: string
}

const normalizeLookupError = (error: unknown): DictionaryLookupError => {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status) || null
    : null

  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message || '')
    : ''

  if (status === 429) {
    return {
      status,
      message: message || '查词请求过于频繁，请稍后重试',
    }
  }

  if (status && status >= 500) {
    return {
      status,
      message: message || '查询失败，请稍后重试',
    }
  }

  return {
    status,
    message: message || '查询失败，请稍后重试',
  }
}

export const lookupWord = async (
  word: string,
  context?: DictionaryLookupContext
): Promise<DictionaryEntry> => {
  try {
    return await request<DictionaryEntry>({
      method: 'GET',
      url: `/api/dictionary/${encodeURIComponent(word)}`,
      params: context,
    })
  } catch (error) {
    throw normalizeLookupError(error)
  }
}
