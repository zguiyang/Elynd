import { test } from '@japa/runner'
import {
  buildCanonicalChapterText,
  extractCanonicalChapterParts,
  isDividerBlock,
  isFrontMatterBlock,
  isIllustrationPlaceholder,
  removeBlockNoise,
  splitIntoBlocks,
  normalizeSpeechText,
} from '#services/book-parse/book_text_normalizer'

test.group('book_text_normalizer', () => {
  test('detects divider blocks made of punctuation', async ({ assert }) => {
    assert.isTrue(isDividerBlock('----------------------------------------'))
    assert.isTrue(isDividerBlock('***'))
    assert.isTrue(isDividerBlock('__________'))
    assert.isFalse(isDividerBlock('Not a divider'))
  })

  test('detects illustration placeholders', async ({ assert }) => {
    assert.isTrue(isIllustrationPlaceholder('[Illustration]'))
    assert.isTrue(isIllustrationPlaceholder('[Illustration: Frog]'))
    assert.isTrue(isIllustrationPlaceholder('[illustration 1]'))
    assert.isFalse(isIllustrationPlaceholder('Some normal text'))
  })

  test('detects front matter publisher blocks', async ({ assert }) => {
    assert.isTrue(isFrontMatterBlock('FREDERICK WARNE & CO., 1902'))
    assert.isTrue(isFrontMatterBlock('PRINTED AND BOUND IN GREAT BRITAIN'))
    assert.isTrue(isFrontMatterBlock('First published 1902'))
    assert.isTrue(isFrontMatterBlock('All rights reserved'))
  })

  test('splits content into blocks on blank lines', async ({ assert }) => {
    const blocks = splitIntoBlocks('block1\n\nblock2\n\nblock3')

    assert.equal(blocks.length, 3)
    assert.equal(blocks[0], 'block1')
  })

  test('removes divider and illustration blocks from content', async ({ assert }) => {
    const cleaned = removeBlockNoise([
      'publisher info',
      '-----',
      '[Illustration]',
      'real content',
    ])

    assert.deepEqual(cleaned, ['publisher info', 'real content'])
  })

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
    assert.notInclude(result.content, '----------------------------------------')
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
