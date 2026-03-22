import { test } from '@japa/runner'
import { normalizeDictionaryMeanings } from '#utils/dictionary_meanings'

test.group('Dictionary meanings normalization', () => {
  test('normalizes legacy meanings with definitions into the new flat shape', ({ assert }) => {
    const result = normalizeDictionaryMeanings([
      {
        partOfSpeech: 'verb',
        localizedMeaning: '携带',
        plainExplanation: '携带',
        definitions: [
          {
            sourceText: 'to carry something',
            localizedText: '携带某物',
            plainExplanation: '携带某物',
            examples: [
              {
                sourceText: 'She is carrying a bag.',
                localizedText: '她正拿着一个包。',
                source: 'dictionary',
              },
            ],
          },
        ],
      },
    ])

    assert.deepEqual(result, [
      {
        partOfSpeech: 'verb',
        localizedMeaning: '携带',
        explanation: '携带',
        examples: [
          {
            sourceText: 'to carry something',
            localizedText: '携带某物',
            source: 'dictionary',
          },
        ],
      },
    ])
  })

  test('parses stringified meaning payloads and preserves modern entries', ({ assert }) => {
    const result = normalizeDictionaryMeanings(
      JSON.stringify([
        {
          partOfSpeech: 'noun',
          localizedMeaning: '苹果',
          explanation: '一种水果',
          examples: [
            {
              sourceText: 'An apple a day.',
              localizedText: '一天一个苹果。',
              source: 'dictionary',
            },
          ],
        },
      ])
    )

    assert.deepEqual(result, [
      {
        partOfSpeech: 'noun',
        localizedMeaning: '苹果',
        explanation: '一种水果',
        examples: [
          {
            sourceText: 'An apple a day.',
            localizedText: '一天一个苹果。',
            source: 'dictionary',
          },
        ],
      },
    ])
  })
})
