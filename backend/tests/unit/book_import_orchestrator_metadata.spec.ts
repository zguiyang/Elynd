import { test } from '@japa/runner'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'

test.group('BookImportOrchestratorService.semanticExtractMetadata', () => {
  test('uses parsed title as fileName hint and truncates metadata sample text', async ({
    assert,
  }) => {
    let receivedInput: Record<string, unknown> | null = null

    const semanticCleanerMock = {
      extractMetadata: async (input: Record<string, unknown>) => {
        receivedInput = input
        return {
          title: 'Alice in Wonderland',
          author: 'Lewis Carroll',
          description: 'A classic novel',
        }
      },
    }

    const orchestrator = new BookImportOrchestratorService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      semanticCleanerMock as any,
      {} as any
    )

    const hugeText = 'A'.repeat(7000)
    const parsed = {
      title: 'The Real Parsed Title',
      author: null,
      description: null,
      chapters: [
        { title: 'Chapter 1', content: hugeText, chapterIndex: 0 },
        { title: 'Chapter 2', content: hugeText, chapterIndex: 1 },
        { title: 'Chapter 3', content: hugeText, chapterIndex: 2 },
      ],
      wordCount: 1000,
    }

    const metadata = await orchestrator.semanticExtractMetadata({
      book: { rawFileName: 'pg14838.epub', source: 'user_uploaded' } as any,
      parsed,
    })

    assert.equal(metadata.title, 'Alice in Wonderland')
    assert.equal(receivedInput?.['fileName'], 'The Real Parsed Title')
    assert.isAtMost(String(receivedInput?.['sampleText'] || '').length, 5000)
  })
})
