import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/dictionary/dictionary_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

interface AiDictionaryEntry {
  word: string
  phonetic?: string
  meanings: Array<{
    partOfSpeech: string
    localizedMeaning: string
    explanation: string
    examples: Array<{
      sourceText: string
      localizedText: string
      source: 'dictionary' | 'article' | 'ai'
    }>
  }>
  meta: {
    source: 'dictionary'
    localizationLanguage: string
  }
}

const buildAiDictionaryEntry = (overrides: Partial<AiDictionaryEntry> = {}): AiDictionaryEntry => ({
  word: 'apple',
  phonetic: '/ˈæp.əl/',
  meanings: [
    {
      partOfSpeech: 'noun',
      localizedMeaning: '苹果',
      explanation: '就是一种常见水果，日常生活里很常见。',
      examples: [
        {
          sourceText: 'A fruit',
          localizedText: '一种水果',
          source: 'dictionary',
        },
        {
          sourceText: 'An apple a day keeps the doctor away.',
          localizedText: '一天一个苹果，医生远离我。',
          source: 'dictionary',
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

test.group('Dictionary API contract', () => {
  test('GET /api/dictionary/:word returns enriched dictionary entry and forwards lookup context', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary User',
      emailPrefix: 'dictionary',
    })
    const originalLookup = (DictionaryService.prototype as any).lookup
    let capturedParams: Record<string, unknown> | null = null

    ;(DictionaryService.prototype as any).lookup = async function fakeLookupWithAi(
      params: Record<string, unknown>
    ) {
      capturedParams = params
      return buildAiDictionaryEntry({
        word: 'apple',
        meta: {
          source: 'dictionary',
          localizationLanguage: 'zh-CN',
        },
      })
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookup = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/apple?bookId=12&chapterIndex=3')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().word, 'apple')
    assert.equal(response.body().phonetic, '/ˈæp.əl/')
    assert.equal(response.body().meanings[0].localizedMeaning, '苹果')
    assert.equal(response.body().meanings[0].explanation, '就是一种常见水果，日常生活里很常见。')
    assert.equal(response.body().meanings[0].examples[0].localizedText, '一种水果')
    assert.equal(response.body().meta.source, 'dictionary')
    assert.deepEqual(capturedParams, {
      word: 'apple',
      userId: user.id,
      bookId: 12,
      chapterIndex: 3,
    })
  })

  test('GET /api/dictionary/:word returns unified failure message when upstream lookup misses', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary User',
      emailPrefix: 'dictionary',
    })
    const originalLookup = (DictionaryService.prototype as any).lookup

    ;(DictionaryService.prototype as any).lookup = async function fakeLookupFailure() {
      throw new Exception('查询失败，请稍后重试', { status: 503 })
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookup = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/banana?bookId=12&chapterIndex=3')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(503)
    assert.equal(response.body().message, '查询失败，请稍后重试')
  })

  test('GET /api/dictionary/:word validates word format, length, and context query', async ({
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary Validate User',
      emailPrefix: 'dictionary-validate',
    })

    cleanup(async () => {
      await user.delete()
    })

    const invalidFormatResponse = await client
      .get('/api/dictionary/invalid!')
      .header('Authorization', bearerAuthHeader(token))

    invalidFormatResponse.assertStatus(422)

    const tooLongWord = 'a'.repeat(65)
    const tooLongResponse = await client
      .get(`/api/dictionary/${tooLongWord}`)
      .header('Authorization', bearerAuthHeader(token))

    tooLongResponse.assertStatus(422)

    const invalidQueryResponse = await client
      .get('/api/dictionary/apple?bookId=abc&chapterIndex=3')
      .header('Authorization', bearerAuthHeader(token))

    invalidQueryResponse.assertStatus(422)
  })

  test('GET /api/dictionary/:word returns unified failure message when lookup fails', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary Error User',
      emailPrefix: 'dictionary-error',
    })
    const originalLookup = (DictionaryService.prototype as any).lookup

    ;(DictionaryService.prototype as any).lookup = async function fakeLookupWithAi() {
      throw new Exception('查询失败，请稍后重试', { status: 503 })
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookup = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/grape')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(503)
    assert.equal(response.body().message, '查询失败，请稍后重试')
  })
})
