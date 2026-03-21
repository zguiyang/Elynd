import { test } from '@japa/runner'
import {
  buildCanonicalChapterText,
  extractCanonicalChapterParts,
  normalizeSpeechText,
} from '#services/book-parse/book_text_normalizer'

test.group('book_text_normalizer', () => {
  test('extracts canonical body from mixed front matter chapters', async ({ assert }) => {
    const result = extractCanonicalChapterParts({
      title: 'FREDERICK WARNE',
      content:
        'THE TALE OF PETER RABBIT\n\n----------------------------------------\n\nFIRST PUBLISHED 1902\n\nFREDERICK WARNE & CO., 1902\n\nPRINTED AND BOUND IN GREAT BRITAIN BY WILLIAM CLOWES LIMITED, BECCLES AND LONDON\n\n----------------------------------------\n\nOnce upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.',
    })

    assert.equal(result.title, 'THE TALE OF PETER RABBIT')
    assert.include(result.content, 'Once upon a time there were four little Rabbits')
    assert.notInclude(result.content, 'FIRST PUBLISHED 1902')
    assert.notInclude(result.content, 'FREDERICK WARNE & CO., 1902')
  })

  test('normalizes speech text into a stable TTS-safe form', async ({ assert }) => {
    const result = normalizeSpeechText('Fish & Chips — said “Peter” with ﬁne ﬂour.')

    assert.include(result, 'Fish amp Chips')
    assert.notInclude(result, '—')
    assert.include(result, '"Peter"')
    assert.include(result, 'fine flour')
  })

  test('builds canonical chapter text from title and normalized content', async ({ assert }) => {
    const result = buildCanonicalChapterText('Chapter 1', 'FISH & CHIPS')

    assert.equal(result, 'Chapter 1\n\nFISH amp CHIPS')
  })
})
