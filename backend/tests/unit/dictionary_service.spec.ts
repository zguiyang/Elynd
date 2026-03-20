import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/shared/dictionary_service'
import { DICTIONARY } from '#constants'

interface AiDictionaryExample {
  sourceText: string
  localizedText: string
  source: 'dictionary' | 'article' | 'ai'
}

interface AiDictionaryDefinition {
  sourceText: string
  localizedText: string
  plainExplanation: string
  examples: AiDictionaryExample[]
}

interface AiDictionaryMeaning {
  partOfSpeech: string
  localizedMeaning: string
  plainExplanation: string
  definitions: AiDictionaryDefinition[]
}

interface AiDictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Array<{
    text?: string
    audio?: string
  }>
  meanings: AiDictionaryMeaning[]
  meta: {
    source: 'dictionary_plus_ai' | 'ai_fallback'
    localizationLanguage: string
  }
}

const buildAiDictionaryEntry = (overrides: Partial<AiDictionaryEntry> = {}): AiDictionaryEntry => ({
  word: 'apple',
  phonetic: '/ˈæp.əl/',
  phonetics: [{ text: '/ˈæp.əl/' }],
  meanings: [
    {
      partOfSpeech: 'noun',
      localizedMeaning: '苹果',
      plainExplanation: '就是一种常见水果，日常生活里很常见。',
      definitions: [
        {
          sourceText: 'A fruit',
          localizedText: '一种水果',
          plainExplanation: '能吃的水果。',
          examples: [
            {
              sourceText: 'An apple a day keeps the doctor away.',
              localizedText: '一天一个苹果，医生远离我。',
              source: 'dictionary',
            },
          ],
        },
      ],
    },
  ],
  meta: {
    source: 'dictionary_plus_ai',
    localizationLanguage: 'zh-CN',
  },
  ...overrides,
})

const createDictionaryService = () => {
  const aiService = {} as never
  const configService = {
    getAiConfig: async () => ({}),
  } as never
  const promptService = {
    render: () => 'dictionary output contract',
  } as never
  const userConfigService = {
    getConfigByUserId: async () => ({ nativeLanguage: 'zh-CN' }),
  } as never

  return new DictionaryService(aiService, configService, promptService, userConfigService)
}

test.group('DictionaryService.getExpiringKeys', (group) => {
  const originalRedisScan = redis.scan.bind(redis)
  const originalRedisTtl = redis.ttl.bind(redis)

  group.each.teardown(() => {
    redis.scan = originalRedisScan
    redis.ttl = originalRedisTtl
  })

  test('TTL 低于阈值时 key 被包含', async ({ assert }) => {
    redis.scan = async function fakeScan() {
      return ['0', [`${DICTIONARY.CACHE_PREFIX}apple`, `${DICTIONARY.CACHE_PREFIX}banana`]]
    } as typeof redis.scan

    redis.ttl = async function fakeTtl(key: string) {
      if (String(key).endsWith('apple')) return 3600 // 1 hour in seconds
      if (String(key).endsWith('banana')) return 172800 // 2 days in seconds
      return -2
    } as typeof redis.ttl

    const service = createDictionaryService()
    const result = await service.getExpiringKeys(1)

    assert.isTrue(
      result.some((k) => k.endsWith('apple')),
      'TTL=3600 should be included (below 1 day threshold)'
    )
    assert.isFalse(
      result.some((k) => k.endsWith('banana')),
      'TTL=172800 should be excluded (above 1 day threshold)'
    )
  })

  test('TTL 高于阈值时 key 被排除', async ({ assert }) => {
    redis.scan = async function fakeScan() {
      return ['0', [`${DICTIONARY.CACHE_PREFIX}long-ttl-key`]]
    } as typeof redis.scan

    redis.ttl = async function fakeTtl() {
      return 172800 // 2 days in seconds, above 1 day threshold
    } as typeof redis.ttl

    const service = createDictionaryService()
    const result = await service.getExpiringKeys(1)

    assert.deepEqual(result, [])
  })

  test('负数 TTL 被排除', async ({ assert }) => {
    redis.scan = async function fakeScan() {
      return ['0', [`${DICTIONARY.CACHE_PREFIX}expired-key`]]
    } as typeof redis.scan

    redis.ttl = async function fakeTtl() {
      return -1 // key does not exist or has no TTL
    } as typeof redis.ttl

    const service = createDictionaryService()
    const result = await service.getExpiringKeys(1)

    assert.deepEqual(result, [])
  })
})

test.group('DictionaryService.lookupWithAi', (group) => {
  const originalRedisGet = redis.get.bind(redis)
  const originalRedisSetex = redis.setex.bind(redis)
  const originalFetch = global.fetch

  group.each.teardown(() => {
    redis.get = originalRedisGet
    redis.setex = originalRedisSetex
    global.fetch = originalFetch
  })

  test('returns cached unified entry without calling external APIs', async ({ assert }) => {
    const cachedEntry = buildAiDictionaryEntry({
      phonetic: '/cached/',
      phonetics: [{ text: '/cached/' }],
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '缓存苹果',
          plainExplanation: '缓存里的苹果词条。',
          definitions: [
            {
              sourceText: 'A fruit',
              localizedText: '一种水果',
              plainExplanation: '能吃的水果。',
              examples: [
                {
                  sourceText: 'Cached example',
                  localizedText: '缓存示例',
                  source: 'dictionary',
                },
              ],
            },
          ],
        },
      ],
      meta: {
        source: 'dictionary_plus_ai',
        localizationLanguage: 'zh-CN',
      },
    })

    const service = createDictionaryService() as any
    let fetchCalled = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
      aiConfig: {},
    })
    service.loadChapterContext = async () => null
    service.getCachedEntry = async () => cachedEntry
    service.fetchUpstreamEntry = async () => {
      fetchCalled = true
      throw new Error('fetch should not be called for cache hit')
    }

    const result = await service.lookupWithAi('apple', { userId: 1 })

    assert.deepEqual(result, cachedEntry)
    assert.isFalse(fetchCalled)
  })

  test('uses AI enrichment when dictionary upstream returns data', async ({ assert }) => {
    let cachedKey: string | null = null
    let cachedValue: string | null = null
    let cachedTtl: number | null = null

    const baseEntry = {
      word: 'apple',
      entries: [
        {
          partOfSpeech: 'noun',
          pronunciations: [{ text: '/ˈæp.əl/' }],
          senses: [{ definition: 'A fruit', examples: ['An apple a day.'] }],
        },
      ],
    }

    const aiEntry = buildAiDictionaryEntry({
      meta: {
        source: 'dictionary_plus_ai',
        localizationLanguage: 'zh-CN',
      },
    })

    const service = createDictionaryService() as any
    service.resolveLookupSettings = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 42)
      assert.equal(options.bookId, 7)
      assert.equal(options.chapterIndex, 3)
      return {
        localizationLanguage: 'zh-CN',
        aiConfig: {},
      }
    }
    service.loadChapterContext = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 42)
      assert.equal(options.bookId, 7)
      assert.equal(options.chapterIndex, 3)
      return null
    }
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async (word: string) => {
      assert.equal(word, 'apple')
      return baseEntry
    }
    service.enrichWithAiCore = async (params: {
      word: string
      upstream: typeof baseEntry
      localizationLanguage: string
      chapterContext: null
      aiConfig: Record<string, unknown>
    }) => {
      assert.equal(params.word, 'apple')
      assert.equal(params.localizationLanguage, 'zh-CN')
      assert.deepEqual(params.upstream, baseEntry)
      return aiEntry
    }
    service.setCachedEntry = async (
      word: string,
      entry: AiDictionaryEntry,
      localizationLanguage: string
    ) => {
      cachedKey = `${DICTIONARY.CACHE_PREFIX}${word}`
      cachedTtl = DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60
      cachedValue = JSON.stringify({
        localizationLanguage,
        entry,
      })
    }

    const result = await service.lookupWithAi('Apple', {
      userId: 42,
      bookId: 7,
      chapterIndex: 3,
    })

    assert.equal(result?.word, 'apple')
    assert.equal(result?.meanings[0]?.localizedMeaning, '苹果')
    assert.equal(result?.meanings[0]?.definitions[0]?.sourceText, 'A fruit')
    assert.equal(
      result?.meanings[0]?.definitions[0]?.examples[0]?.localizedText,
      '一天一个苹果，医生远离我。'
    )
    assert.equal(result?.meta.source, 'dictionary_plus_ai')
    assert.equal(cachedKey, `${DICTIONARY.CACHE_PREFIX}apple`)
    assert.equal(cachedTtl, DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60)
    assert.isString(cachedValue)
  })

  test('uses AI fallback when dictionary upstream returns empty data', async ({ assert }) => {
    const fallbackEntry = buildAiDictionaryEntry({
      word: 'banana',
      phonetic: '/bəˈnæn.ə/',
      meta: {
        source: 'ai_fallback',
        localizationLanguage: 'zh-CN',
      },
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '香蕉',
          plainExplanation: '就是香蕉。',
          definitions: [
            {
              sourceText: 'A yellow fruit',
              localizedText: '黄色水果',
              plainExplanation: '黄黄的，能吃。',
              examples: [
                {
                  sourceText: 'Bananas are yellow.',
                  localizedText: '香蕉是黄色的。',
                  source: 'ai',
                },
              ],
            },
          ],
        },
      ],
    })

    const service = createDictionaryService() as any
    service.resolveLookupSettings = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 9)
      assert.equal(options.bookId, 11)
      assert.equal(options.chapterIndex, 2)
      return {
        localizationLanguage: 'zh-CN',
        aiConfig: {},
      }
    }
    service.loadChapterContext = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 9)
      assert.equal(options.bookId, 11)
      assert.equal(options.chapterIndex, 2)
      return null
    }
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => null
    service.fallbackWithAiCore = async (params: {
      word: string
      localizationLanguage: string
      chapterContext: null
      aiConfig: Record<string, unknown>
    }) => {
      assert.equal(params.word, 'banana')
      assert.equal(params.localizationLanguage, 'zh-CN')
      return fallbackEntry
    }
    service.setCachedEntry = async () => {}

    const result = await service.lookupWithAi('banana', {
      userId: 9,
      bookId: 11,
      chapterIndex: 2,
    })

    assert.equal(result?.word, 'banana')
    assert.equal(result?.meta.source, 'ai_fallback')
    assert.equal(result?.meanings[0]?.localizedMeaning, '香蕉')
    assert.equal(result?.meanings[0]?.definitions[0]?.examples[0]?.source, 'ai')
  })

  test('uses AI fallback when dictionary upstream throws', async ({ assert }) => {
    const fallbackEntry = buildAiDictionaryEntry({
      word: 'orange',
      meta: {
        source: 'ai_fallback',
        localizationLanguage: 'zh-CN',
      },
    })

    const service = createDictionaryService() as any
    service.resolveLookupSettings = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 15)
      return {
        localizationLanguage: 'zh-CN',
        aiConfig: {},
      }
    }
    service.loadChapterContext = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => {
      throw new Error('fatectionary unavailable')
    }
    service.fallbackWithAiCore = async (params: {
      word: string
      localizationLanguage: string
      chapterContext: null
      aiConfig: Record<string, unknown>
    }) => {
      assert.equal(params.word, 'orange')
      assert.equal(params.localizationLanguage, 'zh-CN')
      return fallbackEntry
    }
    service.setCachedEntry = async () => {}

    const result = await service.lookupWithAi('orange', {
      userId: 15,
    })

    assert.equal(result?.word, 'orange')
    assert.equal(result?.meta.source, 'ai_fallback')
  })

  test('throws unified query failure when dictionary and AI both fail', async ({ assert }) => {
    const service = createDictionaryService() as any
    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
      aiConfig: {},
    })
    service.loadChapterContext = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => null
    service.fallbackWithAiCore = async () => {
      throw new Error('AI failed')
    }

    try {
      await service.lookupWithAi('grape', {
        userId: 22,
      })
      assert.fail('Expected lookupWithAi to throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 503)
      assert.equal((error as Exception).message, '查询失败，请稍后重试')
    }
  })
})
