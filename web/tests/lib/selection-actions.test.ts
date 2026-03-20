import { describe, it, expect } from 'vitest'
import { isSingleWordSelection, normalizeSelectionText } from '@/lib/selection-actions'

describe('selection-actions', () => {
  it('normalizes leading and trailing punctuation with quote normalization', () => {
    expect(normalizeSelectionText('  “hello,”  ')).toBe('hello')
    expect(normalizeSelectionText('‘world’')).toBe('world')
  })

  it('accepts a valid single English word', () => {
    expect(isSingleWordSelection('reading')).toBe(true)
    expect(isSingleWordSelection('co-op')).toBe(true)
    expect(isSingleWordSelection('can\'t')).toBe(true)
  })

  it('rejects invalid selection cases', () => {
    expect(isSingleWordSelection('')).toBe(false)
    expect(isSingleWordSelection('two words')).toBe(false)
    expect(isSingleWordSelection('123')).toBe(false)
    expect(isSingleWordSelection('half_word')).toBe(false)
  })

  it('rejects partial word when range boundary is inside a word', () => {
    const textNode = document.createTextNode('prefixWordSuffix')
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.setEnd(textNode, 10)

    expect(isSingleWordSelection('Word', range)).toBe(false)
  })

  it('accepts full word when range boundaries are word boundaries', () => {
    const textNode = document.createTextNode('hello world,')
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.setEnd(textNode, 11)

    expect(isSingleWordSelection('world', range)).toBe(true)
  })
})
