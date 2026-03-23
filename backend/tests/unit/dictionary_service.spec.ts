import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/dictionary/dictionary_service'
import { DICTIONARY } from '#constants'

interface AiDictionaryExample {
  sourceText: string
  localizedText: string
  source: 'dictionary' | 'article' | 'ai'
}

interface AiDictionaryMeaning {
  partOfSpeech: string
  localizedMeaning: string
  explanation: string
  examples: AiDictionaryExample[]
}

interface AiDictionaryLegacyDefinition {
  sourceText?: string
  localizedText?: string
  plainExplanation?: string
  examples?: AiDictionaryExample[]
}

interface AiDictionaryEntryInput {
  word?: string
  phonetic?: string
  meanings?: Array<{
    partOfSpeech?: string
    localizedMeaning?: string
    explanation?: string
    plainExplanation?: string
    sourceMeaning?: string
    examples?: AiDictionaryExample[]
    definitions?: AiDictionaryLegacyDefinition[]
  }>
  meta?: {
    source: 'dictionary'
    localizationLanguage: string
  }
  // Legacy compatibility fields accepted by the builder, but omitted from the normalized output.
  phonetics?: Array<{
    text?: string
    audio?: string
  }>
  plainExplanation?: string
  sourceMeaning?: string
  definitions?: AiDictionaryLegacyDefinition[]
  articleExamples?: Array<{
    sourceText: string
    localizedText: string
    source: 'article' | 'ai'
  }>
}

interface AiDictionaryEntry {
  word: string
  phonetic?: string
  meanings: AiDictionaryMeaning[]
  meta: {
    source: 'dictionary'
    localizationLanguage: string
  }
}

const buildAiDictionaryEntry = (overrides: AiDictionaryEntryInput = {}): AiDictionaryEntry => {
  const legacyDefinitions = overrides.definitions || overrides.meanings?.[0]?.definitions || []
  const legacyExamples = legacyDefinitions.flatMap((definition) => definition.examples || [])
  const normalizedMeanings = overrides.meanings || [
    {
      partOfSpeech: 'noun',
      localizedMeaning: '苹果',
      explanation: '就是一种常见水果，日常生活里很常见。',
      examples: [
        {
          sourceText: 'An apple a day keeps the doctor away.',
          localizedText: '一天一个苹果，医生远离我。',
          source: 'dictionary',
        },
      ],
    },
  ]

  return {
    word: overrides.word ?? 'apple',
    phonetic: overrides.phonetic ?? '/ˈæp.əl/',
    meanings: normalizedMeanings.map((meaning, index) => ({
      partOfSpeech: meaning.partOfSpeech ?? 'noun',
      localizedMeaning: meaning.localizedMeaning === undefined ? '苹果' : meaning.localizedMeaning,
      explanation:
        meaning.explanation ??
        meaning.plainExplanation ??
        overrides.plainExplanation ??
        '就是一种常见水果，日常生活里很常见。',
      examples: (meaning.examples && meaning.examples.length > 0
        ? meaning.examples
        : index === 0
          ? legacyExamples
          : []
      ).map((example) => ({
        sourceText: example.sourceText,
        localizedText: example.localizedText,
        source: example.source,
      })),
    })),
    meta: overrides.meta || {
      source: 'dictionary',
      localizationLanguage: 'zh-CN',
    },
  }
}

const createDictionaryService = (
  overrides: {
    aiService?: {
      chatJson: (config: unknown, params: unknown) => Promise<unknown>
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

  test('does not enqueue enrichment for complete cached entry', async ({ assert }) => {
    const cachedEntry = buildAiDictionaryEntry({
      word: 'rabbits',
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '兔子',
          plainExplanation: '一种常见的哺乳动物。',
          definitions: [
            {
              sourceText: 'A rabbit',
              localizedText: '兔子',
              plainExplanation: '一种常见的兔类动物。',
              examples: [
                {
                  sourceText: 'The rabbit hopped away.',
                  localizedText: '兔子跳开了。',
                  source: 'dictionary',
                },
              ],
            },
          ],
        },
      ],
    })

    const service = createDictionaryService() as any
    let queued = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => cachedEntry
    service.fetchUpstreamEntry = async () => {
      throw new Error('fetch should not be called for cache hit')
    }
    service.queueDictionaryEnrichment = async () => {
      queued = true
    }

    const result = await service.lookup('rabbits', { userId: 1 })

    assert.deepEqual(result, cachedEntry)
    assert.isFalse(queued)
  })

  test('enqueues enrichment for cached entry without Chinese localized text', async ({
    assert,
  }) => {
    const untranslatedEntry = buildAiDictionaryEntry({
      word: 'rabbits',
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: 'plural of rabbit',
          plainExplanation: 'plural of rabbit',
          definitions: [
            {
              sourceText: 'plural of rabbit',
              localizedText: 'plural of rabbit',
              plainExplanation: 'plural of rabbit',
              examples: [],
            },
          ],
        },
      ],
    })

    const service = createDictionaryService() as any
    let queued = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => untranslatedEntry
    service.fetchUpstreamEntry = async () => {
      throw new Error('fetch should not be called for cache hit')
    }
    service.queueDictionaryEnrichment = async () => {
      queued = true
    }

    const result = await service.lookup('rabbits', { userId: 1 })

    assert.deepEqual(result, untranslatedEntry)
    assert.isTrue(queued)
  })

  test('enqueues enrichment for incomplete cached entry', async ({ assert }) => {
    const incompleteEntry = buildAiDictionaryEntry({
      word: 'rabbits',
      meanings: [
        {
          partOfSpeech: 'noun',
          localizedMeaning: '',
          plainExplanation: '一种常见的哺乳动物。',
          definitions: [
            {
              sourceText: 'A rabbit',
              localizedText: '兔子',
              plainExplanation: '一种常见的兔类动物。',
              examples: [],
            },
          ],
        },
      ],
    })

    const service = createDictionaryService() as any
    let queuedPayload: { word: string; mode: 'enrich' | 'fallback' } | null = null

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => incompleteEntry
    service.fetchUpstreamEntry = async () => {
      throw new Error('fetch should not be called for cache hit')
    }
    service.queueDictionaryEnrichment = async (payload: {
      word: string
      mode: 'enrich' | 'fallback'
    }) => {
      queuedPayload = payload
    }

    const result = await service.lookup('Rabbits', {
      userId: 1,
      bookId: 9268,
      chapterIndex: 0,
    })

    assert.equal(result.word, 'rabbits')
    if (!queuedPayload) {
      assert.fail('Expected enrichment to be queued')
    }
    const payload = queuedPayload as unknown as { word: string; mode: 'enrich' | 'fallback' }
    assert.equal(payload.word, 'rabbits')
    assert.equal(payload.mode, 'enrich')
  })

  test('returns cached entries as-is without AI enrichment', async ({ assert }) => {
    const cachedEntry = buildAiDictionaryEntry({
      word: 'carry',
      phonetic: '/cached/',
      phonetics: [{ text: '/cached/' }],
      meanings: [
        {
          partOfSpeech: 'verb',
          localizedMeaning: 'to carry',
          plainExplanation: 'to carry',
          definitions: [
            {
              sourceText: 'to carry',
              localizedText: 'to carry',
              plainExplanation: 'to carry',
              examples: [],
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
    let aiCalled = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => cachedEntry
    service.fetchUpstreamEntry = async () => {
      aiCalled = true
      throw new Error('fetch should not be called for cache hit')
    }

    const result = await service.lookup('carry', { userId: 8 })

    assert.deepEqual(result, cachedEntry)
    assert.isFalse(aiCalled)
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
    assert.equal(result?.meanings[0]?.explanation, 'A fruit')
    assert.equal(result?.meanings[0]?.examples[0]?.sourceText, 'An apple a day.')
    assert.equal(result?.meanings[0]?.examples[0]?.localizedText, 'An apple a day.')
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
      meanings: entry.meanings,
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
      meanings: AiDictionaryEntry['meanings']
      metaSource: 'dictionary'
    }) => ({
      word: record.word,
      sourceLanguage: record.sourceLanguage,
      localizationLanguage: record.localizationLanguage,
      phonetic: record.phonetic,
      meanings: record.meanings,
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

  test('returns database entries as-is without AI enrichment', async ({ assert }) => {
    const dbEntry = buildAiDictionaryEntry({
      word: 'carry',
      phonetic: '/db/',
      phonetics: [{ text: '/db/' }],
      meanings: [
        {
          partOfSpeech: 'verb',
          localizedMeaning: 'to carry',
          plainExplanation: 'to carry',
          definitions: [
            {
              sourceText: 'to carry',
              localizedText: 'to carry',
              plainExplanation: 'to carry',
              examples: [],
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
    let aiCalled = false

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.getCachedEntry = async () => null
    service.findDictionaryEntryRecord = async () => ({
      id: 7,
      word: 'carry',
      sourceLanguage: 'en',
      localizationLanguage: 'zh-CN',
      phonetic: dbEntry.phonetic,
      meanings: dbEntry.meanings,
      metaSource: 'dictionary',
    })
    service.fetchUpstreamEntry = async () => {
      aiCalled = true
      return null
    }

    const result = await service.lookup('carry', { userId: 3 })

    assert.equal(result.meanings[0]?.localizedMeaning, 'to carry')
    assert.isFalse(aiCalled)
  })

  test('does not use AI enrichment in direct lookup even when requested', async ({ assert }) => {
    let aiCalls = 0
    let savedEntry: AiDictionaryEntry | null = null
    let cachedEntry: AiDictionaryEntry | null = null

    const service = createDictionaryService({
      aiService: {
        chatJson: async () => {
          aiCalls++
          throw new Error('AI should not be called for direct lookup')
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

    const result = (await service.lookup('carrying', {
      userId: 9,
      allowAiEnrichment: true,
    })) as AiDictionaryEntry

    assert.equal(aiCalls, 0)
    assert.equal(result.word, 'carrying')
    assert.equal(result.meanings[0]?.partOfSpeech, 'verb')
    assert.equal(result.meanings[0]?.localizedMeaning, 'to carry something')
    assert.equal(result.meanings[0]?.explanation, 'to carry something')
    assert.equal(result.meanings[0]?.examples[0]?.localizedText, 'She is carrying a bag.')
    assert.equal(
      (savedEntry as AiDictionaryEntry | null)?.meanings[0]?.localizedMeaning,
      'to carry something'
    )
    assert.equal(
      (cachedEntry as AiDictionaryEntry | null)?.meanings[0]?.localizedMeaning,
      'to carry something'
    )
  })

  test('direct lookup fails without upstream entry even when ai enrichment is requested', async ({
    assert,
  }) => {
    let aiCalls = 0

    const service = createDictionaryService({
      aiService: {
        chatJson: async () => {
          aiCalls++
          throw new Error('AI should not be called for direct lookup')
        },
      },
    }) as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.findDictionaryEntryRecord = async () => null
    service.getCachedEntry = async () => null
    service.fetchUpstreamEntry = async () => null

    try {
      await service.lookup('banana', {
        userId: 11,
        allowAiEnrichment: true,
      })
      assert.fail('Expected lookup to throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 503)
      assert.equal((error as Exception).message, '查询失败，请稍后重试')
      assert.equal(aiCalls, 0)
    }
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

  test('lookupBatchWithDiagnostics repairs failed words in batches of five without retrying failed ai chunks', async ({
    assert,
  }) => {
    const savedWords: string[] = []
    const cachedWords: string[] = []
    let aiCalls = 0

    const service = createDictionaryService({
      aiService: {
        chatJson: async (_config, params) => {
          aiCalls++
          const promptText = JSON.stringify(params)
          assert.include(promptText, 'dictionary/batch-fallback')

          if (aiCalls === 1) {
            throw new Error('batch failed')
          }

          return {
            entries: [
              {
                word: 'omega-6',
                phonetic: '/ˈoʊmɛɡə/',
                phonetics: [{ text: '/ˈoʊmɛɡə/' }],
                meanings: [
                  {
                    partOfSpeech: 'noun',
                    sourceMeaning: 'omega',
                    localizedMeaning: '欧米茄',
                    plainExplanation: '最后一个、终点的意思。',
                    definitions: [
                      {
                        sourceText: 'the last letter',
                        localizedText: '最后一个字母',
                        plainExplanation: '表示最后的东西。',
                        examples: [],
                      },
                    ],
                  },
                ],
                articleExamples: [],
                meta: {
                  source: 'dictionary',
                  localizationLanguage: 'zh-CN',
                  lookupMode: 'ai_fallback',
                },
              },
            ],
          }
        },
      },
    }) as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.getCachedEntry = async () => null
    service.findDictionaryEntryRecord = async () => null
    service.fetchUpstreamEntry = async () => null
    service.saveGlobalEntry = async (entry: AiDictionaryEntry) => {
      savedWords.push(entry.word)
      return { id: savedWords.length }
    }
    service.cacheEntry = async (entry: AiDictionaryEntry) => {
      cachedWords.push(entry.word)
    }

    const result = await service.lookupBatchWithDiagnostics(
      ['alpha-1', 'alpha-2', 'alpha-3', 'alpha-4', 'alpha-5', 'omega-6'],
      5,
      { allowAiEnrichment: true }
    )

    assert.equal(aiCalls, 2)
    assert.deepEqual(savedWords, ['omega-6'])
    assert.deepEqual(cachedWords, ['omega-6'])
    assert.equal(result.diagnostics.succeededWords, 1)
    assert.equal(result.diagnostics.aiFallbackWords, 1)
    assert.equal(result.diagnostics.dictionaryOnlyWords, 0)
    assert.lengthOf(result.diagnostics.failedWords, 5)
    assert.equal(result.entries.get('omega-6')?.word, 'omega-6')
    assert.isNull(result.entries.get('alpha-1'))
  })

  test('lookupBatchWithDiagnostics accepts ai batch entries that use top-level fallback fields', async ({
    assert,
  }) => {
    const savedWords: string[] = []
    const cachedWords: string[] = []

    const service = createDictionaryService({
      aiService: {
        chatJson: async () => ({
          entries: [
            {
              word: 'mcgregor',
              phonetic: '/mækˈɡreɡər/',
              phonetics: [{ text: '/mækˈɡreɡər/' }],
              partOfSpeech: 'proper noun',
              sourceMeaning: 'McGregor',
              localizedMeaning: '麦格雷戈，常见姓氏。',
              plainExplanation: '这是一个常见的姓氏或专有名词。',
              definitions: [
                {
                  sourceText: 'McGregor',
                  localizedText: '麦格雷戈',
                  plainExplanation: '常见姓氏。',
                  examples: [],
                },
              ],
              articleExamples: [],
              meta: {
                source: 'dictionary',
                localizationLanguage: 'zh-CN',
                lookupMode: 'ai_fallback',
              },
            },
          ],
        }),
      },
    }) as any

    service.resolveLookupSettings = async () => ({
      localizationLanguage: 'zh-CN',
    })
    service.getCachedEntry = async () => null
    service.findDictionaryEntryRecord = async () => null
    service.fetchUpstreamEntry = async () => null
    service.saveGlobalEntry = async (entry: AiDictionaryEntry) => {
      savedWords.push(entry.word)
      return { id: savedWords.length }
    }
    service.cacheEntry = async (entry: AiDictionaryEntry) => {
      cachedWords.push(entry.word)
    }

    const result = await service.lookupBatchWithDiagnostics(['mcgregor'], 5, {
      allowAiEnrichment: true,
    })

    assert.deepEqual(savedWords, ['mcgregor'])
    assert.deepEqual(cachedWords, ['mcgregor'])
    assert.equal(result.diagnostics.succeededWords, 1)
    assert.equal(result.diagnostics.aiFallbackWords, 1)
    assert.lengthOf(result.diagnostics.failedWords, 0)
    assert.equal(result.entries.get('mcgregor')?.meanings[0]?.partOfSpeech, 'proper noun')
    assert.equal(
      result.entries.get('mcgregor')?.meanings[0]?.localizedMeaning,
      '麦格雷戈，常见姓氏。'
    )
  })
})
