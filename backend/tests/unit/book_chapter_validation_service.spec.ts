import { test } from '@japa/runner'
import { BookChapterValidationService } from '#services/book-parse/book_chapter_validation_service'

type MockAiResponder = (context: { promptName: string; payload: Record<string, unknown> }) => unknown

function createService(mockAiResponder?: MockAiResponder) {
  const mockAiService = {
    chatJson: async (_config: unknown, params: { messages: Array<{ content: string }> }) => {
      const rawPrompt = params.messages[1]?.content || '{}'
      const promptData = JSON.parse(rawPrompt) as {
        __promptName?: string
        __payload?: Record<string, unknown>
      }
      const promptName = promptData.__promptName || 'unknown'
      const payload = promptData.__payload || {}

      if (!mockAiResponder) {
        if (promptName === 'book/chapter-quality-judge') {
          const chapters = Array.isArray((payload as Record<string, unknown>).chapters)
            ? ((payload as Record<string, unknown>).chapters as Array<Record<string, unknown>>)
            : []
          return {
            passed: true,
            chapterScores: chapters.map((chapter, index) => ({
              chapterIndex:
                typeof chapter.chapterIndex === 'number' ? chapter.chapterIndex : index,
              cleanliness: 95,
              semanticPreservation: 95,
              coherenceAfterMerge: 95,
              total: 95,
              passed: true,
              reasons: [],
            })),
          }
        }

        throw new Error('mock ai unavailable')
      }

      return mockAiResponder({ promptName, payload })
    },
    chat: async () => '',
  }

  const mockPromptService = {
    render: (name: string, data: Record<string, any>) =>
      JSON.stringify({ __promptName: name, __payload: data }),
  }

  const mockConfigService = {
    getAiConfig: async () => ({
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
    }),
  }

  const mockContentGuardService = {
    checkNonReadingSection: (_content: string) => null,
  }

  return new BookChapterValidationService(
    mockAiService as any,
    mockPromptService as any,
    mockConfigService as any,
    mockContentGuardService as any
  )
}

test.group('BookChapterValidationService.validateChapters', () => {
  test('removes duplicated chapter title lines at chapter beginning', async ({ assert }) => {
    const service = createService()

    const result = await service.validateChapters([
      {
        chapterIndex: 0,
        title: 'Chapter 3',
        content:
          'Chapter 3\n\nChapter 3\n\nAlice was beginning to get very tired of sitting by her sister on the bank.',
      },
    ])

    assert.equal(result.chapters.length, 1)
    assert.equal(result.chapters[0].title, 'Chapter 3')
    assert.notInclude(result.chapters[0].content.toLowerCase(), 'chapter 3\n\nchapter 3')
    assert.notEqual(result.chapters[0].content.split('\n')[0].trim().toLowerCase(), 'chapter 3')
  })

  test('preserves poem line breaks instead of flattening into one line', async ({ assert }) => {
    const service = createService()

    const result = await service.validateChapters([
      {
        chapterIndex: 0,
        title: 'Chapter 2',
        content: `Alice said:\n\n“How doth the little crocodile\nImprove his shining tail,\nAnd pour the waters of the Nile\nOn every golden scale!\n\nHow cheerfully he seems to grin,\nHow neatly spread his claws,\nAnd welcome little fishes in\nWith gently smiling jaws!”`,
      },
    ])

    assert.equal(result.chapters.length, 1)
    assert.include(result.chapters[0].content, 'crocodile\nImprove his shining tail,')
    assert.include(result.chapters[0].content, 'tail,\nAnd pour the waters of the Nile')
  })

  test('removes split heading block from chapter content beginning', async ({ assert }) => {
    const service = createService()

    const result = await service.validateChapters([
      {
        chapterIndex: 0,
        title: 'CHAPTER II. The Pool of Tears',
        content:
          'CHAPTER II.\n\nThe Pool of Tears\n\n“Curiouser and curiouser!” cried Alice. She was so much surprised that she almost forgot how to speak good English.',
      },
    ])

    assert.equal(result.chapters.length, 1)
    assert.equal(result.chapters[0].title, 'CHAPTER II. The Pool of Tears')
    assert.isFalse(result.chapters[0].content.startsWith('CHAPTER II.'))
    assert.isFalse(result.chapters[0].content.startsWith('The Pool of Tears'))
    assert.include(result.chapters[0].content, '“Curiouser and curiouser!” cried Alice.')
  })

  test('merges short chapter into next chapter when chapter is too short', async ({ assert }) => {
    const service = createService()

    const result = await service.validateChapters([
      {
        chapterIndex: 0,
        title: 'Interlude',
        content:
          'Thank you all for reading this book and supporting this journey through curious stories.',
      },
      {
        chapterIndex: 1,
        title: 'Chapter 1',
        content:
          'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it. So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies.',
      },
    ])

    assert.equal(result.chapters.length, 1)
    assert.equal(result.chapters[0].title, 'Chapter 1')
    assert.include(result.chapters[0].content, 'Thank you all for reading this book')
    assert.include(result.chapters[0].content, 'Alice was beginning to get very tired')
  })

  test('retries review inside validation step and succeeds without pipeline retry', async ({
    assert,
  }) => {
    let judgeCalls = 0
    const service = createService(({ promptName }) => {
      if (promptName === 'book/chapter-quality-judge') {
        judgeCalls++
        if (judgeCalls === 1) {
          return {
            passed: false,
            chapterScores: [
              {
                chapterIndex: 0,
                cleanliness: 72,
                semanticPreservation: 94,
                coherenceAfterMerge: 76,
                total: 81,
                passed: false,
                reasons: ['contains_toc_residue'],
              },
            ],
          }
        }

        return {
          passed: true,
          chapterScores: [
            {
              chapterIndex: 0,
              cleanliness: 95,
              semanticPreservation: 96,
              coherenceAfterMerge: 93,
              total: 95,
              passed: true,
              reasons: [],
            },
          ],
        }
      }

      if (promptName === 'book/chapter-content-repair') {
        return {
          content:
            'Alice was beginning to get very tired of sitting by her sister on the bank.\n\nShe had nothing to do, and the afternoon felt slow and quiet.',
        }
      }

      throw new Error(`unexpected prompt: ${promptName}`)
    })

    const result = await service.validateChapters([
      {
        chapterIndex: 0,
        title: 'Chapter 1',
        content:
          'Alice was beginning to get very tired of sitting by her sister on the bank. Table of Contents appeared by mistake in this chapter text and should be cleaned.',
      },
    ])

    assert.equal(result.chapters.length, 1)
    assert.equal(judgeCalls, 2)
    assert.equal(result.stats.reviewRetries, 1)
    assert.deepEqual(result.stats.reviewFailedChapterIndexes, [])
    assert.equal(result.stats.reviewScoreDigest.length, 1)
    assert.equal(result.stats.reviewScoreDigest[0].passed, true)
  })

  test('fails with chapter indexes when review still fails after retry', async ({ assert }) => {
    let judgeCalls = 0
    const service = createService(({ promptName }) => {
      if (promptName === 'book/chapter-quality-judge') {
        judgeCalls++
        return {
          passed: false,
          chapterScores: [
            {
              chapterIndex: 0,
              cleanliness: 60,
              semanticPreservation: 90,
              coherenceAfterMerge: 65,
              total: 72,
              passed: false,
              reasons: ['contains_toc_residue'],
            },
          ],
        }
      }

      if (promptName === 'book/chapter-content-repair') {
        return {
          content:
            'Alice was beginning to get very tired of sitting by her sister on the bank. Table of Contents remained in this text.',
        }
      }

      throw new Error(`unexpected prompt: ${promptName}`)
    })

    await assert.rejects(
      () =>
        service.validateChapters([
          {
            chapterIndex: 0,
            title: 'Chapter 1',
            content:
              'Alice was beginning to get very tired of sitting by her sister on the bank. Table of Contents appeared by mistake in this chapter text and should be cleaned.',
          },
        ]),
      'Chapter quality review failed after retry. Failed chapters: 0'
    )
    assert.equal(judgeCalls, 2)
  })
})
