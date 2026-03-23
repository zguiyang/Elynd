import { test } from '@japa/runner'
import redis from '@adonisjs/redis/services/main'
import ChapterTranslation from '#models/chapter_translation'
import { CHAPTER_TRANSLATION } from '#constants'
import { ChapterTranslationService } from '#services/book/chapter_translation_service'

test.group('ChapterTranslationService cache key', (group) => {
  const originalRedisGet = redis.get.bind(redis)
  const originalRedisSetex = redis.setex.bind(redis)
  const originalChapterTranslationFind = ChapterTranslation.find

  group.each.teardown(() => {
    redis.get = originalRedisGet
    redis.setex = originalRedisSetex
    ChapterTranslation.find = originalChapterTranslationFind
  })

  test('requestTranslation uses flat cache key', async ({ assert }) => {
    let capturedKey: string | null = null

    redis.get = async function fakeGet(key: string) {
      capturedKey = String(key)
      return JSON.stringify({
        title: {
          original: 'Original title',
          translated: 'Translated title',
        },
        paragraphs: [],
      })
    } as typeof redis.get

    const service = new ChapterTranslationService({} as any, {} as any, {} as any)

    ;(service as any).findReadableChapter = async () => ({
      id: 12,
      bookId: 34,
      title: 'Chapter title',
      content: 'Chapter content',
    })

    const result = await service.requestTranslation({
      chapterId: 12,
      userId: 1,
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    assert.equal(result.status, 'completed')
    assert.equal(result.translationId, null)
    assert.isNotNull(capturedKey)
    assert.match(capturedKey!, /^chapter_translation:34:12:en:zh:[a-f0-9]{64}$/)
  })

  test('getChapterResult uses flat cache key', async ({ assert }) => {
    let capturedKey: string | null = null

    redis.get = async function fakeGet(key: string) {
      capturedKey = String(key)
      return JSON.stringify({
        title: {
          original: 'Original title',
          translated: 'Translated title',
        },
        paragraphs: [],
      })
    } as typeof redis.get

    const service = new ChapterTranslationService({} as any, {} as any, {} as any)

    ;(service as any).findReadableChapter = async () => ({
      id: 12,
      bookId: 34,
      title: 'Chapter title',
      content: 'Chapter content',
    })

    const result = await service.getChapterResult({
      chapterId: 12,
      sourceLanguage: 'en',
      targetLanguage: 'zh',
    })

    assert.equal(result.status, 'completed')
    assert.equal(result.translationId, null)
    assert.isNotNull(capturedKey)
    assert.match(capturedKey!, /^chapter_translation:34:12:en:zh:[a-f0-9]{64}$/)
  })

  test('processTranslation writes cache with the same flat key format', async ({ assert }) => {
    let capturedSetexKey: string | null = null

    redis.setex = async function fakeSetex(key, _ttl, _value) {
      capturedSetexKey = String(key)
      return 'OK'
    } as typeof redis.setex

    const fakeTranslation = {
      id: 99,
      chapterId: 12,
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      contentHash: 'a'.repeat(64),
      status: 'queued',
      errorMessage: null,
      provider: null,
      model: null,
      resultJson: null,
      metadata: null,
      async save() {},
    } as unknown as ChapterTranslation

    ChapterTranslation.find = async function fakeFind() {
      return fakeTranslation
    } as typeof ChapterTranslation.find

    const service = new ChapterTranslationService(
      {
        chatJson: async () => ({
          title: {
            original: 'Original title',
            translated: 'Translated title',
          },
          paragraphs: [],
        }),
      } as any,
      {
        getAiConfig: async () => ({
          model: 'gpt-test-model',
        }),
      } as any,
      {
        render: () => 'prompt',
      } as any
    )

    ;(service as any).findReadableChapter = async () => ({
      id: 12,
      bookId: 34,
      title: 'Chapter title',
      content: 'Chapter content',
    })

    await service.processTranslation(99)

    assert.isNotNull(capturedSetexKey)
    assert.equal(
      capturedSetexKey,
      `${CHAPTER_TRANSLATION.CACHE_PREFIX}:34:12:en:zh:${'a'.repeat(64)}`
    )
  })
})
