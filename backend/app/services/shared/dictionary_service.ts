import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import redis from '@adonisjs/redis/services/main'
import { DICTIONARY } from '#constants'

interface FreeDictionaryApiResult {
  word: string
  entries: Array<{
    partOfSpeech: string
    pronunciations: Array<{
      text: string
    }>
    senses: Array<{
      definition: string
      examples: string[]
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
  private freeDictionaryApiUrl: string

  constructor() {
    this.freeDictionaryApiUrl = env.get('FREE_DICTIONARY_API_URL')
  }

  private getCacheKey(word: string): string {
    return `${DICTIONARY.CACHE_PREFIX}${word.toLowerCase()}`
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DICTIONARY.LOOKUP_TIMEOUT_MS)

    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }

  async getEntry(word: string): Promise<FreeDictionaryApiResult | null> {
    const normalizedWord = word.toLowerCase()

    try {
      const response = await this.fetchWithTimeout(
        `${this.freeDictionaryApiUrl}/entries/en/${encodeURIComponent(normalizedWord)}?translations=false`
      )

      if (!response.ok) {
        if (response.status === 429) {
          throw new Exception('Dictionary upstream rate limited', { status: 503 })
        }
        if (response.status >= 500) {
          throw new Exception('Dictionary upstream unavailable', { status: 502 })
        }
        throw new Exception(`Dictionary API error: ${response.status}`, { status: 502 })
      }

      const data = (await response.json()) as FreeDictionaryApiResult

      if (!data || !Array.isArray(data.entries) || data.entries.length === 0) {
        return null
      }

      return data
    } catch (error) {
      if (error instanceof Exception) {
        throw error
      }
      logger.error({ err: error, word }, 'Failed to fetch entry from free dictionary API')
      throw new Exception('Dictionary upstream unavailable', { status: 502 })
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

    logger.debug({ word }, 'Dictionary lookup cache miss, fetching from free dictionary API')

    const entryResult = await this.getEntry(word)

    if (!entryResult) {
      return null
    }

    const entry: DictionaryEntry = {
      word: entryResult.word.toLowerCase(),
      phonetic: entryResult.entries
        .flatMap((item) => item.pronunciations || [])
        .map((item) => item.text)
        .find((text) => typeof text === 'string' && text.length > 0),
      phonetics: entryResult.entries.flatMap((item) =>
        (item.pronunciations || [])
          .filter((pronunciation) => pronunciation?.text)
          .map((pronunciation) => ({
            text: pronunciation.text,
            audio: undefined,
          }))
      ),
      meanings: entryResult.entries
        .filter((item) => item.partOfSpeech)
        .map((item) => ({
          partOfSpeech: item.partOfSpeech,
          definitions: (item.senses || [])
            .filter((sense) => sense.definition)
            .map((sense) => ({
              definition: sense.definition,
              example: Array.isArray(sense.examples) ? sense.examples[0] : undefined,
            })),
        }))
        .filter((item) => item.definitions.length > 0),
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
