import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import crypto from 'node:crypto'
import { DictionaryService } from '#services/dictionary_service'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'
import Book from '#models/book'
import BookVocabulary from '#models/book_vocabulary'
import BookChapter from '#models/book_chapter'
import BookProcessingStepLog from '#models/book_processing_step_log'
import { BookProcessingLogService } from '#services/book_processing_log_service'

interface GenerateVocabularyPayload {
  bookId: number
}

export default class GenerateBookVocabularyJob extends Job {
  static get concurrency() {
    return 3
  }

  private logService = new BookProcessingLogService()

  async handle(payload: GenerateVocabularyPayload) {
    const { bookId } = payload

    logger.info({ bookId }, 'Starting vocabulary generation with dictionary-only pipeline')

    const book = await Book.find(bookId)
    if (!book) {
      logger.warn({ bookId }, 'Skip vocabulary job because book no longer exists')
      return
    }

    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')

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
      const extractStep = await this.logService.startStep(
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
        const vocabularyWithMeaning = extracted.map((v) => ({
          ...v,
          meaning: '',
          sentence: '',
        }))
        await analyzer.saveVocabulary(bookId, vocabularyWithMeaning)
        extractedWords = extracted.length
      }

      await this.logService.completeStep(extractStep.id, {
        extractedWords,
      })

      // Step 2: dictionary lookup
      const allVocabularies = await BookVocabulary.query().where('bookId', bookId)
      const words = allVocabularies.map((item) => item.word)
      const lookupInputHash = crypto.createHash('md5').update(words.join('|')).digest('hex')
      const lookupStep = await this.logService.startStep(
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
          enrichedWords++
          const audioUrl = entry.phonetics?.find((p) => p.audio)?.audio || null
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
        } else {
          missingEntries++
        }
      }

      if (enrichedWords === 0 && allVocabularies.length > 0) {
        const errorMessage = 'All dictionary lookups failed'
        await this.logService.failStep(lookupStep.id, errorMessage)
        throw new Error(errorMessage)
      }

      await this.logService.completeStep(lookupStep.id, {
        lookedUpWords,
        enrichedWords,
        missingEntries,
      })

      await book.merge({ vocabularyStatus: 'completed' }).save()

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
        await this.logService.failStep(currentStep.id, errorMessage)
      }

      await this.logService.failRun(runLog.id, errorMessage)
      await book.merge({ vocabularyStatus: 'failed' }).save()
      throw error
    }
  }
}
