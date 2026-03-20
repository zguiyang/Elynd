import { request } from '@/lib/request'

export interface DictionaryDefinition {
  definition: string
  example?: string
}

export interface DictionaryMeaning {
  partOfSpeech: string
  definitions: DictionaryDefinition[]
}

export interface DictionaryPhonetic {
  text?: string
  audio?: string
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  phonetics: DictionaryPhonetic[]
  meanings: DictionaryMeaning[]
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

  if (status === 404) {
    return { status, message: '未找到该单词' }
  }

  if (status === 429) {
    return { status, message: '查词请求过于频繁，请稍后重试' }
  }

  if (status && status >= 500) {
    return { status, message: '词典服务暂时不可用，请稍后重试' }
  }

  return {
    status,
    message: message || '查词失败，请稍后重试',
  }
}

export const lookupWord = async (word: string): Promise<DictionaryEntry> => {
  try {
    return await request<DictionaryEntry>({
      method: 'GET',
      url: `/api/dictionary/${encodeURIComponent(word)}`,
    })
  } catch (error) {
    throw normalizeLookupError(error)
  }
}
