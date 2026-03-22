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
    source: 'dictionary'
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
    source: 'dictionary',
    localizationLanguage: 'zh-CN',
  },
  ...overrides,
})

const createDictionaryService = (
  overrides: {
    aiService?: {
      chatJson: (config: unknown, params: unknown) => Promise<AiDictionaryEntry | null>
    }
    promptService?: {
      render: (name: string, data?: object) => string
    }
    configService?: {
      getAiConfig: () => Promise<{ baseUrl: string; apiKey: string; model: string }>
    }
  } = {}
) => {
  const userConfigService = {
    getConfigByUserId: async () => ({ nativeLanguage: 'zh-CN' }),
  } as never
  const aiService =
    overrides.aiService ||
    ({
      chatJson: async () => null,
    } as never)
  const promptService =
    overrides.promptService ||
    ({
      render: (name: string, data?: object) => `${name}:${JSON.stringify(data ?? {})}`,
    } as never)
  const configService =
    overrides.configService ||
    ({
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    } as never)

  return new DictionaryService(
    userConfigService,
    aiService as never,
    promptService as never,
    configService as never
  )
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

test.group('DictionaryService.lookup', (group) => {
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
        source: 'dictionary',
        localizationLanguage: 'zh-CN',
      },
    })

    const service = createDictionaryService() as any
    let fetchCalled = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
      aiConfig: {},
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => cachedEntry
    service.fetchUpstreamEntry = async () => {
      fetchCalled = true
      throw new Error('fetch should not be called for cache hit')
    }

    const result = await service.lookup('apple', { userId: 1 })

    assert.deepEqual(result, cachedEntry)
    assert.isFalse(fetchCalled)
  })

  test('returns dictionary-only entry when upstream returns data', async ({ assert }) => {
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

    const service = createDictionaryService() as any
    service.resolveLookupSettings = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 42)
      return {
        localizationLanguage: 'zh-CN',
        aiConfig: {},
      }
    }
    service.findDictionaryEntryRecord = async (options: {
      word: string
      localizationLanguage: string
    }) => {
      assert.equal(options.word, 'apple')
      assert.equal(options.localizationLanguage, 'zh-CN')
      return null
    }
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async (word: string) => {
      assert.equal(word, 'apple')
      return baseEntry
    }
    service.saveGlobalEntry = async () => ({ id: 1 })
    service.setCachedEntry = async (
      word: string,
      entry: AiDictionaryEntry,
      localizationLanguage: string
    ) => {
      cachedKey = `${DICTIONARY.CACHE_PREFIX}${localizationLanguage}:${word}`
      cachedTtl = DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60
      cachedValue = JSON.stringify({
        localizationLanguage,
        entry,
      })
    }

    const result = await service.lookup('Apple', {
      userId: 42,
      bookId: 7,
      chapterIndex: 3,
    })

    assert.equal(result?.word, 'apple')
    assert.equal(result?.meanings[0]?.localizedMeaning, 'A fruit')
    assert.equal(result?.meanings[0]?.definitions[0]?.sourceText, 'A fruit')
    assert.equal(result?.meanings[0]?.definitions[0]?.examples[0]?.localizedText, 'An apple a day.')
    assert.equal(result?.meta.source, 'dictionary')
    assert.equal(cachedKey, `${DICTIONARY.CACHE_PREFIX}zh-CN:apple`)
    assert.equal(cachedTtl, DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60)
    assert.isString(cachedValue)
  })

  test('returns database entry and refreshes cache when redis misses', async ({ assert }) => {
    let fetchCalled = false
    let cacheWriteCount = 0
    const entry = buildAiDictionaryEntry({
      word: 'apple',
      meta: {
        source: 'dictionary',
        localizationLanguage: 'zh-CN',
      },
    })
    const service = createDictionaryService() as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.getCachedEntry = async () => null
    service.findDictionaryEntryRecord = async () => ({
      id: 1,
      word: 'apple',
      sourceLanguage: 'en',
      localizationLanguage: 'zh-CN',
      phonetic: '/ˈæp.əl/',
      phonetics: entry.phonetics,
      meanings: entry.meanings,
      articleExamples: [],
      metaSource: 'dictionary',
    })
    service.fetchUpstreamEntry = async () => {
      fetchCalled = true
      return null
    }
    service.toDictionaryEntry = (record: {
      word: string
      sourceLanguage: string
      localizationLanguage: string
      phonetic: string | null
      phonetics: Array<{ text?: string; audio?: string }>
      meanings: AiDictionaryEntry['meanings']
      articleExamples: Array<{
        sourceText: string
        localizedText: string
        source: 'article' | 'ai'
      }>
      metaSource: 'dictionary'
    }) => ({
      word: record.word,
      sourceLanguage: record.sourceLanguage,
      localizationLanguage: record.localizationLanguage,
      phonetic: record.phonetic,
      phonetics: record.phonetics,
      meanings: record.meanings,
      articleExamples: record.articleExamples,
      meta: {
        source: record.metaSource,
        localizationLanguage: record.localizationLanguage,
      },
    })
    service.setCachedEntry = async () => {
      cacheWriteCount++
    }

    const result = await service.lookup('apple', { userId: 1 })

    assert.equal(result.word, 'apple')
    assert.equal(result.meta.source, 'dictionary')
    assert.equal(cacheWriteCount, 1)
    assert.isFalse(fetchCalled)
  })

  test('enriches upstream dictionary entries with Chinese meanings via AI', async ({ assert }) => {
    let aiCalls = 0
    let savedEntry: AiDictionaryEntry | null = null
    let cachedEntry: AiDictionaryEntry | null = null

    const service = createDictionaryService({
      aiService: {
        chatJson: async (_config, params) => {
          aiCalls++
          const promptText = JSON.stringify(params)
          assert.include(promptText, 'dictionary/enrich')
          assert.include(promptText, 'carrying')

          return buildAiDictionaryEntry({
            word: 'carrying',
            phonetic: '/ˈkæriɪŋ/',
            phonetics: [{ text: '/ˈkæriɪŋ/' }],
            meanings: [
              {
                partOfSpeech: 'verb',
                localizedMeaning: '携带',
                plainExplanation: '拿着、提着某物。',
                definitions: [
                  {
                    sourceText: 'to carry something',
                    localizedText: '携带某物',
                    plainExplanation: '把东西拿在身上或手里。',
                    examples: [
                      {
                        sourceText: 'She is carrying a bag.',
                        localizedText: '她正提着一个包。',
                        source: 'dictionary',
                      },
                    ],
                  },
                ],
              },
            ],
            meta: {
              source: 'dictionary',
              localizationLanguage: 'zh-CN',
            },
          })
        },
      },
    }) as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => ({
      word: 'carrying',
      entries: [
        {
          partOfSpeech: 'verb',
          pronunciations: [{ text: '/ˈkæriɪŋ/' }],
          senses: [{ definition: 'to carry something', examples: ['She is carrying a bag.'] }],
        },
      ],
    })
    service.saveGlobalEntry = async (entry: AiDictionaryEntry) => {
      savedEntry = entry
      return { id: 42 }
    }
    service.setCachedEntry = async (_word: string, entry: AiDictionaryEntry) => {
      cachedEntry = entry
    }

    const result = (await service.lookup('carrying', { userId: 9 })) as AiDictionaryEntry

    assert.equal(aiCalls, 1)
    assert.equal(result.word, 'carrying')
    assert.equal(result.meanings[0]?.partOfSpeech, 'verb')
    assert.equal(result.meanings[0]?.localizedMeaning, '携带')
    assert.equal(result.meanings[0]?.plainExplanation, '拿着、提着某物。')
    assert.equal(result.meanings[0]?.definitions[0]?.localizedText, '携带某物')
    assert.equal((savedEntry as AiDictionaryEntry | null)?.meanings[0]?.localizedMeaning, '携带')
    assert.equal((cachedEntry as AiDictionaryEntry | null)?.meanings[0]?.localizedMeaning, '携带')
  })

  test('generates a complete fallback entry when dictionary lookup misses', async ({ assert }) => {
    let aiCalls = 0
    let savedEntry: AiDictionaryEntry | null = null

    const service = createDictionaryService({
      aiService: {
        chatJson: async (_config, params) => {
          aiCalls++
          const promptText = JSON.stringify(params)
          assert.include(promptText, 'dictionary/fallback')
          assert.include(promptText, 'banana')

          return buildAiDictionaryEntry({
            word: 'banana',
            phonetic: '/bəˈnæn.ə/',
            phonetics: [{ text: '/bəˈnæn.ə/' }],
            meanings: [
              {
                partOfSpeech: 'noun',
                localizedMeaning: '香蕉',
                plainExplanation: '一种常见的黄色水果。',
                definitions: [
                  {
                    sourceText: 'a long curved fruit',
                    localizedText: '一种长而弯曲的水果',
                    plainExplanation: '常见水果，通常呈黄色。',
                    examples: [
                      {
                        sourceText: 'She ate a banana after lunch.',
                        localizedText: '她午饭后吃了一根香蕉。',
                        source: 'ai',
                      },
                    ],
                  },
                ],
              },
            ],
            meta: {
              source: 'dictionary',
              localizationLanguage: 'zh-CN',
            },
          })
        },
      },
    }) as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => null
    service.saveGlobalEntry = async (entry: AiDictionaryEntry) => {
      savedEntry = entry
      return { id: 99 }
    }
    service.setCachedEntry = async () => {}

    const result = (await service.lookup('banana', { userId: 11 })) as AiDictionaryEntry

    assert.equal(aiCalls, 1)
    assert.equal(result.word, 'banana')
    assert.equal(result.meanings[0]?.partOfSpeech, 'noun')
    assert.equal(result.meanings[0]?.localizedMeaning, '香蕉')
    assert.equal(result.meanings[0]?.plainExplanation, '一种常见的黄色水果。')
    assert.equal(result.meanings[0]?.definitions[0]?.localizedText, '一种长而弯曲的水果')
    assert.equal((savedEntry as AiDictionaryEntry | null)?.meanings[0]?.localizedMeaning, '香蕉')
  })

  test('throws unified query failure when dictionary upstream returns empty data', async ({
    assert,
  }) => {
    const service = createDictionaryService() as any
    service.resolveLookupSettings = async (options: {
      userId?: number
      localizationLanguage?: string | null
      bookId?: number | null
      chapterIndex?: number | null
    }) => {
      assert.equal(options.userId, 9)
      return {
        localizationLanguage: 'zh-CN',
        aiConfig: {},
      }
    }
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => null

    try {
      await service.lookup('banana', {
        userId: 9,
        bookId: 11,
        chapterIndex: 2,
      })
      assert.fail('Expected lookup to throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 503)
      assert.equal((error as Exception).message, '查询失败，请稍后重试')
    }
  })

  test('throws unified query failure when dictionary upstream throws', async ({ assert }) => {
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
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => {
      throw new Error('fatectionary unavailable')
    }

    try {
      await service.lookup('orange', {
        userId: 15,
      })
      assert.fail('Expected lookup to throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 503)
      assert.equal((error as Exception).message, '查询失败，请稍后重试')
    }
  })
})
