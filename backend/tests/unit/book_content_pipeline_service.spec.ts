import { test } from '@japa/runner'
import Book from '#models/book'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookContentPipelineService } from '#services/book-import/pipeline/book_content_pipeline_service'
import EnrichVocabularyJob from '#jobs/enrich_vocabulary_job'

test.group('BookContentPipelineService', () => {
  test('uses semantic clean artifact output for build content and vocab seed', async ({
    assert,
  }) => {
    const calls: {
      stepKey?: string
      artifactKey?: string
      readPath?: string
      dispatched?: boolean
    } = {}

    const BookAny = Book as any
    const EnrichVocabularyJobAny = EnrichVocabularyJob as any
    const originalFindOrFail = BookAny.findOrFail
    const originalDispatch = EnrichVocabularyJobAny.dispatch

    const fakeBook = {
      id: 101,
      title: 'Test Book',
      author: null,
      description: null,
    }

    const orchestrator = {
      getSuccessfulStepOutputRef: async (_runId: number, stepKey: string) => {
        calls.stepKey = stepKey
        assert.equal(stepKey, BOOK_IMPORT_STEP.SEMANTIC_CLEAN)
        return { cleanedChaptersArtifactPath: 'semantic-cleaned.json' }
      },
      requireOutputRefString: (outputRef: Record<string, unknown>, key: string) => {
        calls.artifactKey = key
        assert.equal(key, 'cleanedChaptersArtifactPath')
        return String(outputRef[key])
      },
      readChapterArtifact: async (artifactPath: string) => {
        calls.readPath = artifactPath
        assert.equal(artifactPath, 'semantic-cleaned.json')
        return [
          { title: 'Chapter 1', content: 'Readable content for chapter one', chapterIndex: 0 },
          { title: 'Chapter 2', content: 'Readable content for chapter two', chapterIndex: 1 },
        ]
      },
      persistChaptersAndContentHash: async ({
        cleanedChapters,
      }: {
        cleanedChapters: Array<{ title: string; content: string; chapterIndex: number }>
      }) => {
        assert.equal(cleanedChapters.length, 2)
        assert.equal(cleanedChapters[0].title, 'Chapter 1')
        return {
          contentHash: 'content-hash',
          wordCount: 12,
          readingTime: 1,
        }
      },
      extractVocabulary: async () => [{ word: 'readable', lemma: 'readable', frequency: 2 }],
      assignBookLevel: async () => ({
        levelId: 1,
        levelCode: 'l1',
        uniqueLemmaCount: 1,
        classifiedBy: 'rule' as const,
        reason: 'fallback',
      }),
    }

    const importStateService = {
      assertImportNotCancelled: async () => {},
      startStep: async () => ({ id: 500 }),
      completeStep: async () => {},
      failStep: async () => {},
    }

    BookAny.findOrFail = async () => fakeBook
    EnrichVocabularyJobAny.dispatch = async () => {
      calls.dispatched = true
      return 'enrich-vocab-job'
    }

    try {
      const service = new BookContentPipelineService(orchestrator as any, importStateService as any)

      await service.run({
        bookId: fakeBook.id,
        runId: 77,
        userId: 88,
      })

      assert.equal(calls.stepKey, BOOK_IMPORT_STEP.SEMANTIC_CLEAN)
      assert.equal(calls.artifactKey, 'cleanedChaptersArtifactPath')
      assert.equal(calls.readPath, 'semantic-cleaned.json')
      assert.isTrue(calls.dispatched ?? false)
    } finally {
      BookAny.findOrFail = originalFindOrFail
      EnrichVocabularyJobAny.dispatch = originalDispatch
    }
  })
})
