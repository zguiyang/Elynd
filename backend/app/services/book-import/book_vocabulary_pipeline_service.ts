import { inject } from '@adonisjs/core'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import { BOOK_IMPORT_STEP } from '#constants'
import { DictionaryService } from '#services/shared/dictionary_service'
import { VocabularyAnalyzerService } from '#services/book-parse/vocabulary_analyzer_service'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { ImportStateService } from '#services/book-import/import_state_service'
import GenerateTagsJob from '#jobs/generate_tags_job'
import type { SerialImportPayload } from '#types/book_import_pipeline'

@inject()
export class BookVocabularyPipelineService {
  constructor(
    private dictionaryService: DictionaryService,
    private analyzerService: VocabularyAnalyzerService,
    private importStateService: ImportStateService
  ) {}

  async run(payload: SerialImportPayload) {
    const { bookId, runId, userId } = payload
    const book = await Book.findOrFail(bookId)
    await this.importStateService.assertImportNotCancelled(runId, bookId)
    const progress = BookImportOrchestratorService.getBaseProgressByStep(
      BOOK_IMPORT_STEP.ENRICH_VOCABULARY
    )

    const step = await this.importStateService.startStep(
      runId,
      bookId,
      BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
      progress
    )

    await book.merge({ vocabularyStatus: 'processing' }).save()

    try {
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      let allVocabularies = await BookVocabulary.query().where('bookId', bookId)

      if (allVocabularies.length === 0) {
        const chapters = await BookChapter.query()
          .where('bookId', bookId)
          .orderBy('chapterIndex', 'asc')
        const fullContent = chapters.map((chapter) => chapter.content).join('\n\n')
        const extracted = this.analyzerService.extractVocabulary(fullContent)
        await this.analyzerService.saveVocabulary(
          bookId,
          extracted.map((item) => ({ ...item, meaning: '', sentence: '' }))
        )
        allVocabularies = await BookVocabulary.query().where('bookId', bookId)
      }

      const words = allVocabularies.map((item) => item.word)
      const results = await this.dictionaryService.lookupBatch(words)

      let enrichedWords = 0
      for (const vocabulary of allVocabularies) {
        await this.importStateService.assertImportNotCancelled(runId, bookId)

        const entry = results.get(vocabulary.word.toLowerCase())
        if (!entry) {
          continue
        }

        enrichedWords++
        const audioUrl = entry.phonetics?.find((item) => item.audio)?.audio || null
        const phoneticText = entry.phonetic || entry.phonetics?.[0]?.text || null

        await vocabulary
          .merge({
            phoneticText,
            phoneticAudio: audioUrl,
            details: {
              meanings: entry.meanings,
            },
          })
          .save()
      }
      await this.importStateService.assertImportNotCancelled(runId, bookId)

      if (allVocabularies.length > 0 && enrichedWords === 0) {
        throw new Error('All dictionary lookups failed')
      }

      await book.merge({ vocabularyStatus: 'completed' }).save()

      await this.importStateService.completeStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
        progress,
        {
          totalWords: allVocabularies.length,
          enrichedWords,
        }
      )

      await GenerateTagsJob.dispatch(
        { bookId, runId, userId },
        {
          jobId: BookImportOrchestratorService.buildPipelineJobId({
            runId,
            bookId,
            stepKey: BOOK_IMPORT_STEP.GENERATE_TAGS,
          }),
        }
      )
    } catch (error) {
      if (ImportStateService.isImportCancelledError(error)) {
        await book.refresh()
        if (book.vocabularyStatus === 'processing') {
          await book.merge({ vocabularyStatus: 'pending' }).save()
        }
        return
      }
      await book.merge({ vocabularyStatus: 'failed' }).save()
      const message = error instanceof Error ? error.message : 'Unknown error'
      await this.importStateService.failStep(
        runId,
        step.id,
        bookId,
        BOOK_IMPORT_STEP.ENRICH_VOCABULARY,
        message
      )
      throw error
    }
  }
}
