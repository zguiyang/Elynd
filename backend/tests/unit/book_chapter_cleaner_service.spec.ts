import { test } from '@japa/runner'
import { BookChapterCleanerService } from '#services/book-parse/book_chapter_cleaner_service'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'
import { BookSemanticCleanService } from '#services/book-parse/book_semantic_clean_service'

test.group('BookChapterCleanerService.clean', () => {
  test('drops empty chapters', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      {
        title: 'Chapter 1',
        content: 'Content here with enough words to pass the minimum length threshold',
      },
      { title: 'Chapter 2', content: '' },
      { title: 'Chapter 3', content: '   ' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 1)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.stats.droppedEmpty, 2)
  })

  test('drops short chapters under threshold', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      {
        title: 'Chapter 1',
        content:
          'This is a very long content with many words to exceed the threshold of thirty characters',
      },
      { title: 'Chapter 2', content: 'Short' },
      { title: 'Chapter 3', content: 'Tiny' },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 1)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.stats.droppedShort, 2)
  })

  test('drops noisy title chapters', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      {
        title: 'Chapter 1',
        content: 'Valid content here with many words to pass threshold requirement',
      },
      {
        title: 'Preface',
        content: 'Some preface content with enough words to pass short threshold check',
      },
      {
        title: 'References',
        content: 'References content with enough words to pass threshold requirement',
      },
      {
        title: 'Copyright',
        content: 'Copyright content with enough words to pass threshold check',
      },
      {
        title: 'Acknowledgments',
        content: 'Thanks to everyone for supporting this book project work',
      },
      { title: 'Advertisement', content: 'Buy our product and enjoy the amazing quality features' },
      { title: 'Contents', content: 'Table of contents listing all chapters in this book section' },
      {
        title: 'Chapter 2',
        content: 'Another valid chapter with sufficient content length for requirements',
      },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 2)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.cleanedChapters[1].title, 'Chapter 2')
    assert.equal(result.stats.droppedNoisy, 6)
  })

  test('preserves valid chapters and reindexes chapterIndex', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Preface', content: 'Short content here' },
      {
        title: 'Chapter 1',
        content: 'First valid chapter content with sufficient words to pass threshold',
      },
      {
        title: 'Chapter 2',
        content: 'Second valid chapter content with enough words to be valid and pass',
      },
      { title: 'Empty', content: '' },
      {
        title: 'Chapter 3',
        content: 'Third valid chapter content with sufficient word count to pass check',
      },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 3)
    assert.equal(result.cleanedChapters[0].chapterIndex, 0)
    assert.equal(result.cleanedChapters[1].chapterIndex, 1)
    assert.equal(result.cleanedChapters[2].chapterIndex, 2)
    assert.equal(result.cleanedChapters[0].title, 'Chapter 1')
    assert.equal(result.cleanedChapters[1].title, 'Chapter 2')
    assert.equal(result.cleanedChapters[2].title, 'Chapter 3')
  })

  test('returns correct stats for mixed scenario', async ({ assert }) => {
    const service = new BookChapterCleanerService()
    const chapters = [
      { title: 'Preface', content: 'Preface content with enough words to pass threshold' },
      {
        title: 'Chapter 1',
        content: 'Valid content with enough words to pass threshold requirement',
      },
      { title: 'Chapter 2', content: '' },
      { title: 'References', content: 'References' },
      {
        title: 'Chapter 3',
        content: 'Another valid chapter with sufficient content length for requirements',
      },
    ]

    const result = service.clean(chapters as any)

    assert.equal(result.cleanedChapters.length, 2)
    assert.equal(result.stats.droppedEmpty, 1)
    assert.equal(result.stats.droppedShort, 1)
    assert.equal(result.stats.droppedNoisy, 1)
    assert.equal(result.stats.totalDropped, 3)
    assert.equal(result.stats.totalInput, 5)
  })
})

test.group('BookSemanticCleanService', () => {
  test('extractMetadata maps structured response', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => ({
        title: 'Alice in Wonderland',
        author: 'Lewis Carroll',
        description: 'A fantasy novel',
      }),
    }
    const mockPromptService = {
      render: (_name: string, data: any) => JSON.stringify(data),
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any
    )

    const result = await service.extractMetadata({
      fileName: 'alice.txt',
      sourceType: 'user_uploaded',
      chapterTitles: ['Chapter 1'],
      sampleText: 'Alice was beginning to get very tired',
    })

    assert.equal(result.title, 'Alice in Wonderland')
    assert.equal(result.author, 'Lewis Carroll')
  })

  test('extractMetadata falls back to source metadata when AI times out', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('Request timed out.')
      },
    }
    const mockPromptService = {
      render: (_name: string, data: any) => JSON.stringify(data),
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any
    )

    const result = await service.extractMetadata({
      fileName: 'The Tale of Peter Rabbit',
      sourceType: 'user_uploaded',
      chapterTitles: ['Chapter 1'],
      sampleText: 'Once upon a time there were four little Rabbits.',
    })

    assert.equal(result.title, 'The Tale of Peter Rabbit')
    assert.isNull(result.author)
    assert.isNull(result.description)
  })

  test('cleanChapters uses deterministic rule cleaning and never calls AI', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called for chapter cleaning')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called for chapter cleaning')
      },
    }
    const mockPromptService = {
      render: () => {
        throw new Error('Prompt rendering should not be required for chapter cleaning')
      },
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any
    )

    const result = await service.cleanChapters([
      {
        title: 'Chapter 1',
        content:
          'Valid content here with enough words.\n\nAnother readable paragraph with enough words to stay valid.',
      },
      { title: 'Preface', content: 'Preface content with enough words to pass threshold' },
      { title: 'Chapter 2', content: '' },
    ])

    assert.equal(result.length, 1)
    assert.equal(result[0].title, 'Chapter 1')
    assert.equal(result[0].chapterIndex, 0)
  })

  test('cleanChapters drops AI-classified front matter chapters', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called directly in this test')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called directly in this test')
      },
    }
    const mockPromptService = {
      render: () => 'prompt',
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }
    const mockChapterClassifier = {
      reviewChapter: async (input: { title: string }) =>
        input.title === 'FREDERICK WARNE'
          ? {
              decision: 'drop_front_matter',
              confidence: 0.99,
              reason: 'publisher_page',
              signals: ['publisher_page'],
              reviewedByAi: true,
            }
          : {
              decision: 'keep_as_chapter',
              confidence: 0.99,
              reason: 'reading_content',
              signals: ['narrative_flow'],
              reviewedByAi: true,
            },
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any,
      mockChapterClassifier as any
    )

    const result = await service.cleanChapters([
      { title: 'FREDERICK WARNE', content: '----------------------------------------' },
      {
        title: 'Chapter 1',
        content: 'Once upon a time there were four little Rabbits with a proper story to tell.',
      },
    ])

    assert.equal(result.length, 1)
    assert.equal(result[0].title, 'Chapter 1')
  })

  test('cleanChapters canonicalizes mixed front matter chapters before persistence', async ({
    assert,
  }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called directly in this test')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called directly in this test')
      },
    }
    const mockPromptService = {
      render: () => 'prompt',
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }
    const mockChapterClassifier = {
      reviewChapter: async () => ({
        decision: 'keep_as_chapter',
        confidence: 0.99,
        reason: 'reading_content',
        signals: ['narrative_flow'],
        reviewedByAi: true,
      }),
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any,
      mockChapterClassifier as any
    )

    const result = await service.cleanChapters([
      {
        title: 'FREDERICK WARNE',
        content:
          'THE TALE OF PETER RABBIT\n\n----------------------------------------\n\n[Illustration]\n\nFIRST PUBLISHED 1902\n\nFREDERICK WARNE & CO., 1902\n\nPRINTED AND BOUND IN GREAT BRITAIN BY WILLIAM CLOWES LIMITED, BECCLES AND LONDON\n\n----------------------------------------\n\nOnce upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.',
      },
    ])

    assert.equal(result.length, 1)
    assert.equal(result[0].title, 'THE TALE OF PETER RABBIT')
    assert.include(result[0].content, 'Once upon a time there were four little Rabbits')
    assert.notInclude(result[0].content, 'FIRST PUBLISHED 1902')
    assert.notInclude(result[0].content, '[Illustration]')
  })

  test('cleanChapters drops broken paragraphs and noisy sections', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called for chapter cleaning')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called for chapter cleaning')
      },
    }
    const mockPromptService = {
      render: () => {
        throw new Error('Prompt rendering should not be required for chapter cleaning')
      },
    }
    const mockRuleCleaner = new BookChapterCleanerService()
    const mockContentGuard = new BookContentGuardService()
    const mockConfigService = {
      getAiConfig: async () => ({
        baseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
      }),
    }

    const service = new BookSemanticCleanService(
      mockAiService as any,
      mockPromptService as any,
      mockRuleCleaner,
      mockContentGuard,
      mockConfigService as any
    )

    await assert.rejects(
      () =>
        service.cleanChapters([
          {
            title: 'References',
            content: 'References content with enough words to be long enough',
          },
          { title: 'Chapter 2', content: 'Flattened content '.repeat(30) },
          { title: 'Copyright', content: 'Copyright content with enough words to be long enough' },
        ]),
      'No readable chapters after semantic cleaning'
    )
  })
})
