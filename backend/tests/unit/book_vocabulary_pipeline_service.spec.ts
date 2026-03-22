import { test } from '@japa/runner'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookVocabularyPipelineService } from '#services/book-import/book_vocabulary_pipeline_service'
import { createAuthenticatedUser } from '#tests/helpers/auth'
import GenerateTtsJob from '#jobs/generate_tts_job'
import FinalizeImportJob from '#jobs/finalize_import_job'

test.group('BookVocabularyPipelineService', (group) => {
  group.each.teardown(async () => {
    await BookVocabulary.query().delete()
    await BookChapter.query().delete()
    await Book.query().where('title', 'like', 'Vocabulary Pipeline Test%').delete()
  })

  test('dispatches tts generation after vocabulary enrichment instead of tags', async ({
    assert,
  }) => {
    const { user } = await createAuthenticatedUser({ emailPrefix: 'vocab-pipeline' })
    const book = await Book.create({
      title: `Vocabulary Pipeline Test ${Date.now()}`,
      author: 'Author',
      description: 'Description',
      source: 'user_uploaded',
      levelId: 1,
      status: 'processing',
      processingStep: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
      processingProgress: 0,
      processingError: null,
      wordCount: 100,
      readingTime: 1,
      isPublished: false,
      createdBy: user.id,
      audioStatus: 'pending',
      vocabularyStatus: 'pending',
      contentHash: null,
      bookHash: null,
    })

    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 0,
        title: 'Chapter 1',
        content: 'Alpha beta gamma alpha appears in readable content.',
      },
    ])

    const importStateService = {
      assertImportNotCancelled: async () => {},
      startStep: async () => ({ id: 900 }),
      completeStep: async (
        _runId: number,
        _stepLogId: number,
        _bookId: number,
        _stepKey: string,
        _progress: number,
        outputRef?: Record<string, unknown>
      ) => {
        calls.outputRef = outputRef || null
      },
      failStep: async () => {},
    }

    const analyzerService = {
      extractVocabulary: () => [{ word: 'alpha', lemma: 'alpha', frequency: 2 }],
      saveVocabulary: async (
        bookId: number,
        items: Array<{ word: string; lemma: string; frequency: number; sentence: string }>
      ) => {
        await BookVocabulary.create({
          bookId,
          word: items[0].word,
          lemma: items[0].lemma,
          frequency: items[0].frequency,
          sentence: items[0].sentence || 'Alpha appears in readable content.',
          dictionaryEntryId: null,
        })
      },
    }

    let lookupOptions: { allowAiEnrichment?: boolean } | null = null
    const dictionaryService = {
      lookupBatchWithDiagnostics: async (
        _words: string[],
        _concurrency?: number,
        options?: Record<string, unknown>
      ) => {
        lookupOptions = options || null
        return {
          entries: new Map([
            [
              'alpha',
              {
                id: 42,
                word: 'alpha',
                meanings: ['first letter of the Greek alphabet'],
                meta: {
                  source: 'dictionary',
                  localizationLanguage: 'zh-CN',
                  lookupMode: 'ai_enriched',
                },
              },
            ],
          ]),
          diagnostics: {
            totalWords: 1,
            succeededWords: 1,
            failedWords: [],
            dictionaryOnlyWords: 0,
            aiEnrichedWords: 1,
            aiFallbackWords: 0,
            aiBatchFailedChunks: 0,
            aiBatchFailedWords: 0,
          },
        }
      },
      saveGlobalEntry: async (entry: { id: number }) => entry,
      cacheEntry: async () => {},
    }

    const GenerateTtsAny = GenerateTtsJob as any
    const originalGenerateTtsDispatch = GenerateTtsAny.dispatch
    const calls: {
      tts?: Array<Record<string, unknown>>
      outputRef?: Record<string, unknown> | null
    } = {}

    GenerateTtsAny.dispatch = async (payload: Record<string, unknown>) => {
      calls.tts = [...(calls.tts || []), payload]
      return 'generate-tts-job'
    }

    try {
      const service = new BookVocabularyPipelineService(
        dictionaryService as any,
        analyzerService as any,
        importStateService as any
      )

      await service.run({
        bookId: book.id,
        runId: 321,
        userId: user.id,
      })

      assert.lengthOf(calls.tts || [], 1)
      assert.equal(calls.tts?.[0]?.bookId, book.id)
      assert.equal(calls.tts?.[0]?.runId, 321)
      assert.equal(calls.tts?.[0]?.userId, user.id)
      assert.equal(
        (lookupOptions as { allowAiEnrichment?: boolean } | null)?.allowAiEnrichment,
        true
      )
      assert.equal(calls.outputRef?.aiEnrichedWords, 1)
      assert.equal(calls.outputRef?.aiFallbackWords, 0)
      assert.equal(calls.outputRef?.aiRepairedWords, 0)
      assert.equal(calls.outputRef?.aiBatchFailedChunks, 0)
      assert.equal(calls.outputRef?.aiBatchFailedWords, 0)
      assert.equal(calls.outputRef?.dictionaryOnlyWords, 0)
      assert.deepEqual(calls.outputRef?.failedWords, [])
    } finally {
      GenerateTtsAny.dispatch = originalGenerateTtsDispatch
      await user.delete()
    }
  })

  test('dispatches finalize import after vocabulary enrichment when audio is already completed', async ({
    assert,
  }) => {
    const { user } = await createAuthenticatedUser({ emailPrefix: 'vocab-pipeline-finalize' })
    const book = await Book.create({
      title: `Vocabulary Pipeline Test Finalize ${Date.now()}`,
      author: 'Author',
      description: 'Description',
      source: 'user_uploaded',
      levelId: 1,
      status: 'processing',
      processingStep: BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
      processingProgress: 0,
      processingError: null,
      wordCount: 100,
      readingTime: 1,
      isPublished: false,
      createdBy: user.id,
      audioStatus: 'completed',
      vocabularyStatus: 'pending',
      contentHash: null,
      bookHash: null,
    })

    await BookChapter.createMany([
      {
        bookId: book.id,
        chapterIndex: 0,
        title: 'Chapter 1',
        content: 'Alpha beta gamma alpha appears in readable content.',
      },
    ])

    const importStateService = {
      assertImportNotCancelled: async () => {},
      startStep: async () => ({ id: 901 }),
      completeStep: async (
        _runId: number,
        _stepLogId: number,
        _bookId: number,
        _stepKey: string,
        _progress: number,
        outputRef?: Record<string, unknown>
      ) => {
        calls.outputRef = outputRef || null
      },
      failStep: async () => {},
    }

    const analyzerService = {
      extractVocabulary: () => [{ word: 'alpha', lemma: 'alpha', frequency: 2 }],
      saveVocabulary: async (
        bookId: number,
        items: Array<{ word: string; lemma: string; frequency: number; sentence: string }>
      ) => {
        await BookVocabulary.create({
          bookId,
          word: items[0].word,
          lemma: items[0].lemma,
          frequency: items[0].frequency,
          sentence: items[0].sentence || 'Alpha appears in readable content.',
          dictionaryEntryId: null,
        })
      },
    }

    let lookupOptions: { allowAiEnrichment?: boolean } | null = null
    const dictionaryService = {
      lookupBatchWithDiagnostics: async (
        _words: string[],
        _concurrency?: number,
        options?: Record<string, unknown>
      ) => {
        lookupOptions = options || null
        return {
          entries: new Map([
            [
              'alpha',
              {
                id: 42,
                word: 'alpha',
                meanings: ['first letter of the Greek alphabet'],
                meta: {
                  source: 'dictionary',
                  localizationLanguage: 'zh-CN',
                  lookupMode: 'ai_enriched',
                },
              },
            ],
          ]),
          diagnostics: {
            totalWords: 1,
            succeededWords: 1,
            failedWords: [],
            dictionaryOnlyWords: 0,
            aiEnrichedWords: 1,
            aiFallbackWords: 0,
            aiBatchFailedChunks: 0,
            aiBatchFailedWords: 0,
          },
        }
      },
      saveGlobalEntry: async (entry: { id: number }) => entry,
      cacheEntry: async () => {},
    }

    const GenerateTtsAny = GenerateTtsJob as any
    const FinalizeImportAny = FinalizeImportJob as any
    const originalGenerateTtsDispatch = GenerateTtsAny.dispatch
    const originalFinalizeDispatch = FinalizeImportAny.dispatch
    const calls: {
      tts?: Array<Record<string, unknown>>
      finalize?: Array<Record<string, unknown>>
      outputRef?: Record<string, unknown> | null
    } = {}

    GenerateTtsAny.dispatch = async (payload: Record<string, unknown>) => {
      calls.tts = [...(calls.tts || []), payload]
      return 'generate-tts-job'
    }
    FinalizeImportAny.dispatch = async (payload: Record<string, unknown>) => {
      calls.finalize = [...(calls.finalize || []), payload]
      return 'finalize-import-job'
    }

    try {
      const service = new BookVocabularyPipelineService(
        dictionaryService as any,
        analyzerService as any,
        importStateService as any
      )

      await service.run({
        bookId: book.id,
        runId: 322,
        userId: user.id,
      })

      assert.lengthOf(calls.finalize || [], 1)
      assert.equal(calls.finalize?.[0]?.bookId, book.id)
      assert.equal(calls.finalize?.[0]?.runId, 322)
      assert.equal(calls.finalize?.[0]?.userId, user.id)
      assert.lengthOf(calls.tts || [], 0)
      assert.equal(
        (lookupOptions as { allowAiEnrichment?: boolean } | null)?.allowAiEnrichment,
        true
      )
      assert.equal(calls.outputRef?.aiEnrichedWords, 1)
      assert.equal(calls.outputRef?.aiRepairedWords, 0)
      assert.equal(calls.outputRef?.aiBatchFailedChunks, 0)
      assert.equal(calls.outputRef?.aiBatchFailedWords, 0)
      assert.equal(calls.outputRef?.dictionaryOnlyWords, 0)
      assert.deepEqual(calls.outputRef?.failedWords, [])
    } finally {
      GenerateTtsAny.dispatch = originalGenerateTtsDispatch
      FinalizeImportAny.dispatch = originalFinalizeDispatch
      await user.delete()
    }
  })
})
