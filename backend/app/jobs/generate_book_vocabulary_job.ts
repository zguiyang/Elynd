import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import crypto from 'node:crypto'
import { BOOK_IMPORT_STEP } from '#constants'
import { DictionaryService } from '#services/shared/dictionary_service'
import { VocabularyAnalyzerService } from '#services/book-parse/vocabulary_analyzer_service'
import Book from '#models/book'
import BookVocabulary from '#models/book_vocabulary'
import BookChapter from '#models/book_chapter'
import BookProcessingStepLog from '#models/book_processing_step_log'
import { BookProcessingLogService } from '#services/book-import/book_processing_log_service'

interface GenerateVocabularyPayload {
  bookId: number
}

export default class GenerateBookVocabularyJob extends Job {
  static get concurrency() {
    return 3
  }

  async handle(payload: GenerateVocabularyPayload) {
    const { bookId } = payload
    const logService = await app.container.make(BookProcessingLogService)

    logger.info({ bookId }, 'Starting vocabulary generation with dictionary pipeline')

    const book = await Book.find(bookId)
    if (!book) {
      logger.warn({ bookId }, 'Skip vocabulary job because book no longer exists')
      return
    }

    const runLog = await logService.getOrCreateActiveRun(bookId, 'import')

    await book.merge({ vocabularyStatus: 'processing' }).save()

    try {
      // Step 1: extract vocabulary seed
      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      const extractInputHash = crypto
        .createHash('md5')
        .update(chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join('\n---\n'))
        .digest('hex')
      const extractStep = await logService.startStep(
        runLog.id,
        bookId,
        'vocab_extract',
        'extract',
        extractInputHash
      )

      const existingVocabularies = await BookVocabulary.query().where('bookId', bookId)
      let extractedWords = existingVocabularies.length

      if (existingVocabularies.length === 0) {
        const fullContent = chapters.map((chapter) => chapter.content).join('\n\n')
        const analyzer = await app.container.make(VocabularyAnalyzerService)
        const extracted = analyzer.extractVocabulary(fullContent)
        const vocabularySeed = extracted.map((v) => ({
          ...v,
          sentence: '',
        }))
        await analyzer.saveVocabulary(bookId, vocabularySeed)
        extractedWords = extracted.length
      }

      await logService.completeStep(extractStep.id, {
        extractedWords,
      })

      // Step 2: dictionary lookup
      const allVocabularies = await BookVocabulary.query().where('bookId', bookId)
      const words = allVocabularies.map((item) => item.word)
      const lookupInputHash = crypto.createHash('md5').update(words.join('|')).digest('hex')
      const lookupStep = await logService.startStep(
        runLog.id,
        bookId,
        'vocab_lookup_batch',
        'lookup',
        lookupInputHash
      )

      const dictionaryService = await app.container.make(DictionaryService)
      const results = await dictionaryService.lookupBatch(words)

      let lookedUpWords = 0
      let enrichedWords = 0
      let missingEntries = 0

      for (const vocabulary of allVocabularies) {
        const entry = results.get(vocabulary.word.toLowerCase())
        lookedUpWords++

        if (entry) {
          const dictionaryEntry = await dictionaryService.saveGlobalEntry(entry)
          await dictionaryService.cacheEntry(entry)
          enrichedWords++
          await vocabulary.merge({ dictionaryEntryId: dictionaryEntry.id }).save()
        } else {
          missingEntries++
        }
      }

      if (enrichedWords === 0 && allVocabularies.length > 0) {
        const errorMessage = 'All dictionary lookups failed'
        await logService.failStep(lookupStep.id, errorMessage)
        throw new Error(errorMessage)
      }

      await logService.completeStep(lookupStep.id, {
        lookedUpWords,
        enrichedWords,
        missingEntries,
      })

      await book.merge({ vocabularyStatus: 'completed' }).save()
      await this.finalizeIfParallelTasksCompleted(book, runLog.id, logService)

      logger.info(
        {
          bookId,
          extractedWords,
          lookedUpWords,
          enrichedWords,
          missingEntries,
        },
        'Vocabulary generation completed'
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'Vocabulary generation failed')

      const currentStep = await BookProcessingStepLog.query()
        .where('runLogId', runLog.id)
        .where('status', 'processing')
        .first()
      if (currentStep) {
        await logService.failStep(currentStep.id, errorMessage)
      }

      await logService.failRun(runLog.id, errorMessage)
      await book.merge({ vocabularyStatus: 'failed' }).save()
      throw error
    }
  }

  private async finalizeIfParallelTasksCompleted(
    book: Book,
    runId: number,
    logService: BookProcessingLogService
  ) {
    await book.refresh()

    if (book.status === 'cancelled') {
      logger.info({ bookId: book.id, runId }, 'Skip finalize because import is cancelled')
      return
    }

    if (book.audioStatus !== 'completed' || book.vocabularyStatus !== 'completed') {
      return
    }

    await logService.completeRun(runId)

    await book
      .merge({
        status: 'ready',
        processingStep: BOOK_IMPORT_STEP.COMPLETED,
        processingProgress: 100,
        processingError: null,
        isPublished: true,
      })
      .save()

    logger.info({ bookId: book.id, runId }, 'Parallel import tasks finalized')
  }
}
