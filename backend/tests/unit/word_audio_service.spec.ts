import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import { WordAudioService } from '#services/word_audio_service'

test.group('WordAudioService', (group) => {
  const originalRedisGet = redis.get.bind(redis)
  const originalRedisSetex = redis.setex.bind(redis)

  group.each.teardown(() => {
    redis.get = originalRedisGet
    redis.setex = originalRedisSetex
  })

  test('returns cached data uri without synthesizing audio again', async ({ assert }) => {
    let synthesizeCalled = false

    redis.get = async function fakeGet() {
      return 'data:audio/mp3;base64,QUJD'
    } as typeof redis.get

    const service = new WordAudioService({
      getCurrentVoiceName: () => 'en-US-Ava:DragonHDLatestNeural',
      synthesizeTextToBuffer: async () => {
        synthesizeCalled = true
        return Buffer.from('should-not-be-used')
      },
    } as any)

    const audio = await service.getAudio('Hello!')

    assert.equal(audio, 'data:audio/mp3;base64,QUJD')
    assert.isFalse(synthesizeCalled)
  })

  test('normalizes word audio key and caches synthesized audio as data uri', async ({ assert }) => {
    let capturedKey: string | null = null
    let capturedTtl: number | null = null
    let capturedValue: string | null = null
    let capturedText: string | null = null

    redis.get = async function fakeGet() {
      return null
    } as typeof redis.get

    redis.setex = async function fakeSetex(key, ttl, value) {
      capturedKey = String(key)
      capturedTtl = Number(ttl)
      capturedValue = String(value)
      return 'OK'
    } as typeof redis.setex

    const service = new WordAudioService({
      getCurrentVoiceName: () => 'en-US-Ava:DragonHDLatestNeural',
      synthesizeTextToBuffer: async (text: string) => {
        capturedText = text
        return Buffer.from('ABCD')
      },
    } as any)

    const audio = await service.getAudio('Hello!')

    assert.equal(capturedText, 'hello')
    assert.equal(capturedKey, 'word_audio:hello')
    assert.equal(capturedTtl, 60 * 60 * 24 * 30)
    assert.equal(capturedValue, 'data:audio/mp3;base64,QUJDRA==')
    assert.equal(audio, 'data:audio/mp3;base64,QUJDRA==')
  })
})
