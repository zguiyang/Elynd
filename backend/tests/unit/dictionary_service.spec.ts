import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { DictionaryService } from '#services/dictionary_service'
import { DICTIONARY } from '#constants'

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

  test('merges audio and meaning responses on cache miss and writes cache', async ({ assert }) => {
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
      if (url.includes('/apple')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              word: 'apple',
              phonetic: '/ˈæp.əl/',
              phonetics: [{ text: '/ˈæp.əl/', audio: 'https://audio.test/apple.mp3' }],
              meanings: [
                {
                  partOfSpeech: 'noun',
                  definitions: [{ definition: 'A fruit', example: 'An apple a day.' }],
                },
              ],
            },
          ],
        } as Response
      }

      throw new Error(`Unexpected url ${url}`)
    }) as typeof global.fetch

    const service = new DictionaryService()
    const result = await service.lookup('Apple')

    assert.equal(result?.word, 'apple')
    assert.equal(result?.phonetic, '/ˈæp.əl/')
    assert.equal(result?.phonetics[0]?.audio, 'https://audio.test/apple.mp3')
    assert.equal(result?.meanings[0]?.definitions[0]?.definition, 'A fruit')
    assert.equal(cachedKey, `${DICTIONARY.CACHE_PREFIX}apple`)
    assert.equal(cachedTtl, DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60)
    assert.isString(cachedValue)
  })

  test('degrades gracefully when one upstream request fails but the other succeeds', async ({
    assert,
  }) => {
    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get

    redis.setex = async function fakeSetex() {
      return 'OK'
    } as typeof redis.setex

    let callCount = 0

    global.fetch = (async () => {
      callCount += 1

      if (callCount === 1) {
        throw new Error('audio api unavailable')
      }

      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            word: 'banana',
            phonetic: '/bəˈnæn.ə/',
            meanings: [
              {
                partOfSpeech: 'noun',
                definitions: [{ definition: 'A yellow fruit' }],
              },
            ],
          },
        ],
      } as Response
    }) as typeof global.fetch

    const service = new DictionaryService()
    const result = await service.lookup('banana')

    assert.equal(result?.word, 'banana')
    assert.equal(result?.phonetic, '/bəˈnæn.ə/')
    assert.deepEqual(result?.phonetics, [])
    assert.equal(result?.meanings[0]?.definitions[0]?.definition, 'A yellow fruit')
  })
})
