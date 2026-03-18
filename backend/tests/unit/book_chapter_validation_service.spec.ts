import { test } from '@japa/runner'
import { BookChapterValidationService } from '#services/book-parse/book_chapter_validation_service'

function createService() {
  const mockAiService = {
    chatJson: async () => {
      throw new Error('mock ai unavailable')
    },
    chat: async () => '',
  }

  const mockPromptService = {
    render: (_name: string, data: Record<string, any>) => JSON.stringify(data),
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
})
