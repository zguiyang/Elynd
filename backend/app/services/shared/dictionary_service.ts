import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import redis from '@adonisjs/redis/services/main'
import { DICTIONARY } from '#constants'

interface AudioResult {
  word: string
  phonetics: Array<{
    text?: string
    audio?: string
  }>
}

interface MeaningResult {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

export interface DictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Array<{
    text?: string
    audio?: string
  }>
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{
      definition: string
      example?: string
    }>
  }>
}

@inject()
export class DictionaryService {
  private audioApiUrl: string
  private meaningApiUrl: string

  constructor() {
    this.audioApiUrl = env.get(
      'DICTIONARY_API_DEV_URL',
      'https://api.dictionaryapi.dev/api/v2/entries/en'
    )
    this.meaningApiUrl = env.get(
      'FREE_DICTIONARY_API_URL',
      'https://api.dictionaryapi.dev/api/v2/entries/en'
    )
  }

  private getCacheKey(word: string): string {
    return `${DICTIONARY.CACHE_PREFIX}${word.toLowerCase()}`
  }

  async getAudio(word: string): Promise<AudioResult | null> {
    try {
      const response = await fetch(`${this.audioApiUrl}/${encodeURIComponent(word.toLowerCase())}`)

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Exception(`Audio API error: ${response.status}`, { status: response.status })
      }

      const data = (await response.json()) as Array<AudioResult>

      if (!data || data.length === 0) {
        return null
      }

      return data[0]
    } catch (error) {
      logger.error({ err: error, word }, 'Failed to fetch audio from dictionary API')
      return null
    }
  }

  async getMeaning(word: string): Promise<MeaningResult | null> {
    try {
      const response = await fetch(
        `${this.meaningApiUrl}/${encodeURIComponent(word.toLowerCase())}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Exception(`Meaning API error: ${response.status}`, { status: response.status })
      }

      const data = (await response.json()) as Array<MeaningResult>

      if (!data || data.length === 0) {
        return null
      }

      return data[0]
    } catch (error) {
      logger.error({ err: error, word }, 'Failed to fetch meaning from dictionary API')
      return null
    }
  }

  async lookup(word: string): Promise<DictionaryEntry | null> {
    const cacheKey = this.getCacheKey(word)

    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        logger.debug({ word }, 'Dictionary lookup cache hit')
        return JSON.parse(cached) as DictionaryEntry
      }
    } catch (error) {
      logger.warn({ err: error, word }, 'Failed to get cache, falling back to API')
    }

    logger.debug({ word }, 'Dictionary lookup cache miss, fetching from APIs')

    const results = await Promise.allSettled([this.getAudio(word), this.getMeaning(word)])

    const audioResult = results[0].status === 'fulfilled' ? results[0].value : null
    const meaningResult = results[1].status === 'fulfilled' ? results[1].value : null

    if (results[0].status === 'rejected') {
      logger.warn(
        { word, source: 'audio', reason: String(results[0].reason) },
        'Dictionary upstream failed'
      )
    }
    if (results[1].status === 'rejected') {
      logger.warn(
        { word, source: 'meaning', reason: String(results[1].reason) },
        'Dictionary upstream failed'
      )
    }

    if (!audioResult && !meaningResult) {
      return null
    }

    const entry: DictionaryEntry = {
      word: word.toLowerCase(),
      phonetic: meaningResult?.phonetic || audioResult?.phonetics?.[0]?.text,
      phonetics: [],
      meanings: [],
    }

    if (audioResult?.phonetics) {
      entry.phonetics = audioResult.phonetics
    }

    if (meaningResult?.meanings) {
      entry.meanings = meaningResult.meanings
    }

    const hasUsableData =
      entry.meanings.length > 0 ||
      entry.phonetics.length > 0 ||
      (typeof entry.phonetic === 'string' && entry.phonetic.length > 0)

    if (hasUsableData) {
      try {
        const ttlSeconds = DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60
        await redis.setex(cacheKey, ttlSeconds, JSON.stringify(entry))
        logger.debug({ word, ttlDays: DICTIONARY.DEFAULT_TTL_DAYS }, 'Dictionary result cached')
      } catch (error) {
        logger.warn({ err: error, word }, 'Failed to cache dictionary result')
      }
    } else {
      logger.warn({ word }, 'Skipping cache for incomplete dictionary result')
    }

    return entry
  }

  async refreshCache(word: string): Promise<void> {
    const cacheKey = this.getCacheKey(word)
    await redis.del(cacheKey)
    await this.lookup(word)
    logger.info({ word }, 'Dictionary cache refreshed')
  }

  async lookupBatch(
    words: string[],
    concurrency: number = 5
  ): Promise<Map<string, DictionaryEntry | null>> {
    const results = new Map<string, DictionaryEntry | null>()

    const processWord = async (word: string): Promise<[string, DictionaryEntry | null]> => {
      const entry = await this.lookup(word)
      return [word, entry]
    }

    for (let i = 0; i < words.length; i += concurrency) {
      const batch = words.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map(processWord))

      for (const [word, entry] of batchResults) {
        results.set(word, entry)
      }

      if (i + concurrency < words.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    logger.info(
      {
        total: words.length,
        successful: Array.from(results.values()).filter((v) => v !== null).length,
      },
      'Batch lookup completed'
    )

    return results
  }

  async getExpiringKeys(days: number = DICTIONARY.EXPIRING_DAYS): Promise<string[]> {
    try {
      const pattern = `${DICTIONARY.CACHE_PREFIX}*`
      const keys: string[] = []
      let cursor = '0'

      do {
        const [newCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = newCursor
        keys.push(...batch)
      } while (cursor !== '0')

      const expiringKeys: string[] = []
      const thresholdSeconds = days * 24 * 60 * 60

      for (const key of keys) {
        const ttl = await redis.ttl(key)
        if (ttl > 0 && ttl <= thresholdSeconds) {
          expiringKeys.push(key)
        }
      }

      return expiringKeys
    } catch (error) {
      logger.error({ err: error }, 'Failed to get expiring keys')
      return []
    }
  }
}
