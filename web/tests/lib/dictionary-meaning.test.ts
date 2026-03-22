import { describe, expect, it } from 'vitest'
import { getMeaningExamples } from '@/lib/dictionary-meaning'

describe('dictionary-meaning', () => {
  it('returns an empty array when meaning examples are missing', () => {
    expect(getMeaningExamples({})).toEqual([])
    expect(getMeaningExamples({ examples: null })).toEqual([])
    expect(getMeaningExamples(undefined)).toEqual([])
  })

  it('returns the original examples array when meaning examples exist', () => {
    expect(
      getMeaningExamples({
        examples: [
          {
            sourceText: 'A fruit',
            localizedText: '一种水果',
            source: 'dictionary',
          },
        ],
      })
    ).toEqual([
      {
        sourceText: 'A fruit',
        localizedText: '一种水果',
        source: 'dictionary',
      },
    ])
  })
})
