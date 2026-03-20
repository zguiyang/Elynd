import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/shared/dictionary_service'
import { DICTIONARY } from '#constants'

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

    const service = new DictionaryService()
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

    const service = new DictionaryService()
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

    const service = new DictionaryService()
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

  test('returns cached entry without calling external APIs', async ({ assert }) => {
    const cachedEntry = {
      word: 'apple',
      phonetic: '/cached/',
      phonetics: [],
      meanings: [],
    }

    redis.get = async function fakeGet() {
      return JSON.stringify(cachedEntry)
    } as typeof redis.get

    let fetchCalled = false
    global.fetch = (async () => {
      fetchCalled = true
      throw new Error('fetch should not be called for cache hit')
    }) as typeof global.fetch

    const service = new DictionaryService()
    const result = await service.lookup('apple')

    assert.deepEqual(result, cachedEntry)
    assert.isFalse(fetchCalled)
  })

  test('parses Fatectionary response on cache miss and writes cache', async ({ assert }) => {
    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get

    let cachedKey: string | null = null
    let cachedValue: string | null = null
    let cachedTtl: number | null = null

    redis.setex = async function fakeSetex(key, ttl, value) {
      cachedKey = String(key)
      cachedTtl = Number(ttl)
      cachedValue = String(value)
      return 'OK'
    } as typeof redis.setex

    global.fetch = (async (input) => {
      const url = String(input)
      if (url.includes('/entries/en/apple')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            word: 'apple',
            entries: [
              {
                partOfSpeech: 'noun',
                pronunciations: [{ text: '/ˈæp.əl/' }],
                senses: [{ definition: 'A fruit', examples: ['An apple a day.'] }],
              },
            ],
          }),
        } as Response
      }

      throw new Error(`Unexpected url ${url}`)
    }) as typeof global.fetch

    const service = new DictionaryService()
    const result = await service.lookup('Apple')

    assert.equal(result?.word, 'apple')
    assert.equal(result?.phonetic, '/ˈæp.əl/')
    assert.equal(result?.phonetics[0]?.text, '/ˈæp.əl/')
    assert.equal(result?.meanings[0]?.definitions[0]?.definition, 'A fruit')
    assert.equal(result?.meanings[0]?.definitions[0]?.example, 'An apple a day.')
    assert.equal(cachedKey, `${DICTIONARY.CACHE_PREFIX}apple`)
    assert.equal(cachedTtl, DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60)
    assert.isString(cachedValue)
  })

  test('returns null when Fatectionary response has empty entries', async ({ assert }) => {
    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get

    redis.setex = async function fakeSetex() {
      return 'OK'
    } as typeof redis.setex

    global.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          word: 'banana',
          entries: [],
        }),
      } as Response
    }) as typeof global.fetch

    const service = new DictionaryService()
    const result = await service.lookup('banana')

    assert.isNull(result)
  })

  test('throws 502 when Fatectionary upstream request fails', async ({ assert }) => {
    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get

    global.fetch = (async () => {
      throw new Error('fatectionary unavailable')
    }) as typeof global.fetch

    const service = new DictionaryService()

    try {
      await service.lookup('banana')
      assert.fail('Expected lookup to throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 502)
    }
  })
})
