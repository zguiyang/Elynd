import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'
import { DictionaryService } from '#services/shared/dictionary_service'
import { bearerAuthHeader, createAuthenticatedUser } from '#tests/helpers/auth'

interface AiDictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Array<{
    text?: string
    audio?: string
  }>
  meanings: Array<{
    partOfSpeech: string
    localizedMeaning: string
    plainExplanation: string
    definitions: Array<{
      sourceText: string
      localizedText: string
      plainExplanation: string
      examples: Array<{
        sourceText: string
        localizedText: string
        source: 'dictionary' | 'article' | 'ai'
      }>
    }>
  }>
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
    const originalLookup = (DictionaryService.prototype as any).lookupWithAi
    let capturedParams: Record<string, unknown> | null = null

    ;(DictionaryService.prototype as any).lookupWithAi = async function fakeLookupWithAi(
      params: Record<string, unknown>
    ) {
      capturedParams = params
      return buildAiDictionaryEntry({
        word: 'apple',
        meta: {
          source: 'dictionary_plus_ai',
          localizationLanguage: 'zh-CN',
        },
      })
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookupWithAi = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/apple?bookId=12&chapterIndex=3')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().word, 'apple')
    assert.equal(response.body().phonetic, '/ˈæp.əl/')
    assert.equal(response.body().meanings[0].localizedMeaning, '苹果')
    assert.equal(response.body().meanings[0].definitions[0].localizedText, '一种水果')
    assert.equal(
      response.body().meanings[0].definitions[0].examples[0].localizedText,
      '一天一个苹果，医生远离我。'
    )
    assert.equal(response.body().meta.source, 'dictionary_plus_ai')
    assert.deepEqual(capturedParams, {
      word: 'apple',
      userId: user.id,
      bookId: 12,
      chapterIndex: 3,
    })
  })

  test('GET /api/dictionary/:word returns AI fallback entry when dictionary is empty', async ({
    assert,
    client,
    cleanup,
  }) => {
    const { user, token } = await createAuthenticatedUser({
      fullName: 'Dictionary User',
      emailPrefix: 'dictionary',
    })
    const originalLookup = (DictionaryService.prototype as any).lookupWithAi

    ;(DictionaryService.prototype as any).lookupWithAi = async function fakeLookupWithAi() {
      return buildAiDictionaryEntry({
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
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookupWithAi = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/banana?bookId=12&chapterIndex=3')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(200)
    assert.equal(response.body().word, 'banana')
    assert.equal(response.body().meta.source, 'ai_fallback')
    assert.equal(response.body().meanings[0].localizedMeaning, '香蕉')
    assert.equal(response.body().meanings[0].definitions[0].examples[0].source, 'ai')
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
    const originalLookup = (DictionaryService.prototype as any).lookupWithAi

    ;(DictionaryService.prototype as any).lookupWithAi = async function fakeLookupWithAi() {
      throw new Exception('查询失败，请稍后重试', { status: 503 })
    }

    cleanup(async () => {
      ;(DictionaryService.prototype as any).lookupWithAi = originalLookup
      await user.delete()
    })

    const response = await client
      .get('/api/dictionary/grape')
      .header('Authorization', bearerAuthHeader(token))

    response.assertStatus(503)
    assert.equal(response.body().message, '查询失败，请稍后重试')
  })
})
