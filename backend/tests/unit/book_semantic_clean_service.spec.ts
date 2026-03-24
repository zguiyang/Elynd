import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { BookChapterCleanerService } from '#services/book-parse/book_chapter_cleaner_service'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'
import { BookSemanticCleanService } from '#services/book-parse/book_semantic_clean_service'
import { buildCanonicalChapterText } from '#utils/book_text_normalizer'

async function loadFixture<T>(name: string): Promise<T> {
  const filePath = join(process.cwd(), 'tests/fixtures/chapters', `${name}.json`)
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as T
}

test.group('BookSemanticCleanService canonicalization', () => {
  test('returns canonical chapters with identical persistence and TTS text', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called in this test')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called in this test')
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

    const fixture = await loadFixture<{ title: string; content: string }>('9268_chapter0_mixed')
    const result = await service.cleanChapters([fixture])

    assert.equal(result.length, 1)
    assert.equal(result[0].title, 'THE TALE OF PETER RABBIT')
    assert.include(result[0].content, 'Once upon a time there were four little Rabbits')
    assert.notInclude(result[0].content, 'FREDERICK WARNE')
    assert.notInclude(result[0].content, '[Illustration]')
    assert.notInclude(result[0].content, 'PRINTED AND BOUND')
    assert.equal(
      buildCanonicalChapterText(result[0].title, result[0].content),
      'THE TALE OF PETER RABBIT\n\nOnce upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter.'
    )
  })

  test('drops front matter chapters classified as noise', async ({ assert }) => {
    const mockAiService = {
      chatJson: async () => {
        throw new Error('AI should not be called in this test')
      },
      chatJsonChunked: async () => {
        throw new Error('AI should not be called in this test')
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
        decision: 'drop_front_matter',
        confidence: 0.99,
        reason: 'publisher_page',
        signals: ['publisher_page'],
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

    await assert.rejects(
      () =>
        service.cleanChapters([
          {
            title: 'FREDERICK WARNE',
            content: '----------------------------------------',
          },
        ]),
      'No readable chapters after semantic cleaning'
    )
  })
})
