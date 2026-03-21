import { test } from '@japa/runner'
import { BookChapterQualityClassifierService } from '#services/book_chapter_quality_classifier_service'

function createService(overrides?: {
  chatJson?: (config: unknown, params: { messages: Array<{ role: string; content: string }> }) => Promise<unknown>
  render?: (name: string, data: Record<string, unknown>) => string
}) {
  return new BookChapterQualityClassifierService(
    {
      chatJson: overrides?.chatJson || (async () => {
        throw new Error('chatJson should be mocked')
      }),
    } as any,
    {
      render: overrides?.render || ((name: string, data: Record<string, unknown>) => JSON.stringify({ name, data })),
    } as any,
    {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    } as any
  )
}

test.group('BookChapterQualityClassifierService', () => {
  test('builds a three-part sample for front matter chapters and uses AI to classify them', async ({
    assert,
  }) => {
    let capturedPrompt: { name: string; data: Record<string, unknown> } | null = null

    const service = createService({
      render: (name, data) => {
        capturedPrompt = { name, data }
        return 'prompt'
      },
      chatJson: async (_config, params) => {
        assert.equal(params.messages[0].role, 'system')
        assert.equal(params.messages[1].role, 'user')
        return {
          decision: 'drop_front_matter',
          confidence: 0.98,
          reason: 'publisher_information_without_narrative_content',
          signals: ['publisher_page', 'no_narrative_flow'],
        }
      },
    })

    const result = await service.reviewChapter({
      chapterIndex: 0,
      title: 'FREDERICK WARNE',
      content:
        '----------------------------------------\n\nFIRST PUBLISHED 1902\n\nFREDERICK WARNE & CO., 1902\n\nPRINTED AND BOUND IN GREAT BRITAIN BY WILLIAM CLOWES LIMITED, BECCLES AND LONDON\n\n----------------------------------------\n\nOnce upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.\n\nThey lived with their Mother in a sand-bank, underneath the root of a very big fir-tree.\n\nPeter went straight away to Mr. McGregor\'s garden, and the story continued from there.',
      previousTitle: null,
      nextTitle: 'THE TALE OF PETER RABBIT',
    })

    if (!capturedPrompt) {
      throw new Error('Expected prompt capture to be available')
    }
    const promptCapture = capturedPrompt as {
      name: string
      data: Record<string, unknown>
    }
    assert.equal(promptCapture.name, 'book/import/chapter-quality-classification')
    assert.equal(promptCapture.data.chapterIndex, 0)
    assert.equal(promptCapture.data.title, 'FREDERICK WARNE')

    const samples = promptCapture.data.samples as Record<string, string>
    assert.isString(samples.head)
    assert.isString(samples.middle)
    assert.isString(samples.tail)
    assert.include(samples.head, 'FIRST PUBLISHED 1902')
    assert.include(samples.middle, 'Once upon a time')
    assert.include(samples.tail, 'the story continued from there')

    assert.equal(result.decision, 'drop_front_matter')
    assert.equal(result.reviewedByAi, true)
    assert.equal(result.confidence, 0.98)
  })

  test('skips AI review for obvious reading chapters', async ({ assert }) => {
    let aiCalled = false

    const service = createService({
      chatJson: async () => {
        aiCalled = true
        throw new Error('AI should not be called for clear reading chapters')
      },
    })

    const result = await service.reviewChapter({
      chapterIndex: 3,
      title: 'Chapter 3',
      content:
        'The rabbits ran through the garden and met a white cat. They escaped across the fence and returned home in the evening.',
      previousTitle: 'Chapter 2',
      nextTitle: 'Chapter 4',
    })

    assert.isFalse(aiCalled)
    assert.equal(result.decision, 'keep_as_chapter')
    assert.equal(result.reviewedByAi, false)
    assert.equal(result.reason, 'clear_reading_chapter')
  })
})
