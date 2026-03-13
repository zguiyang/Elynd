import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import crypto from 'node:crypto'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import BookChapterAudio from '#models/book_chapter_audio'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import GenerateBookVocabularyJob from '#jobs/generate_book_vocabulary_job'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'
import { TransmitService } from '#services/transmit_service'
import { BookProcessingLogService } from '#services/book_processing_log_service'
import { BookSemanticCleanService } from '#services/book_semantic_clean_service'
import { BookHashService } from '#services/book_hash_service'
import { BookChapterCleanerService } from '#services/book_chapter_cleaner_service'
import PromptService from '#services/prompt_service'
import { AiService } from '#services/ai_service'
import { BOOK_IMPORT_STEP } from '#constants/index'

interface ProcessBookPayload {
  bookId: number
  userId: number
}

export default class ProcessBookJob extends Job {
  static get concurrency() {
    return 2
  }

  private logService = new BookProcessingLogService()
  private hashService = new BookHashService()

  async handle(payload: ProcessBookPayload) {
    const { bookId, userId } = payload
    const book = await Book.find(bookId)

    if (!book) {
      throw new Error(`Book ${bookId} not found`)
    }

    const runLog = await this.logService.getOrCreateActiveRun(bookId, 'import')
    const transmitService = await app.container.make(TransmitService)
    const analyzer = await app.container.make(VocabularyAnalyzerService)
    const aiService = await app.container.make(AiService)
    const semanticCleaner = new BookSemanticCleanService(
      aiService,
      new PromptService(),
      new BookChapterCleanerService()
    )
    const channel = `user:${userId}:book_import`

    const pushStatus = async (data: {
      status: 'processing' | 'ready' | 'failed'
      processingStep: string
      processingProgress: number
      message: string
      processingError?: string | null
    }) => {
      await transmitService.toUser(channel, 'book:import-status', {
        bookId,
        ...data,
      })
    }

    try {
      const rawChapters = await BookChapter.query().where('bookId', bookId).orderBy('chapterIndex', 'asc')
      let cleanedChapters: Array<{ title: string; content: string; chapterIndex: number }> =
        rawChapters.map((chapter) => ({
          title: chapter.title,
          content: chapter.content,
          chapterIndex: chapter.chapterIndex,
        }))
      let contentHash = book.contentHash || ''

      if (rawChapters.length > 0) {
        // Step 1: semantic cleaning
        const semanticInputHash = this.computeChaptersHash(rawChapters)
        await this.logService.advanceRun(runLog.id, BOOK_IMPORT_STEP.SEMANTIC_CLEANING, 10)
        const semanticStep = await this.logService.startStep(
          runLog.id,
          bookId,
          BOOK_IMPORT_STEP.SEMANTIC_CLEANING,
          undefined,
          semanticInputHash
        )

        await book
          .merge({
            status: 'processing',
            processingStep: BOOK_IMPORT_STEP.SEMANTIC_CLEANING,
            processingProgress: 10,
            processingError: null,
          })
          .save()
        await pushStatus({
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.SEMANTIC_CLEANING,
          processingProgress: 10,
          message: 'Semantic cleaning chapters',
        })

        const cleanResult = await semanticCleaner.clean(
          rawChapters.map((chapter) => ({
            title: chapter.title,
            content: chapter.content,
          }))
        )

        if (cleanResult.cleanedChapters.length === 0) {
          throw new Error('All chapters were dropped during semantic cleaning')
        }

        await BookChapter.query().where('bookId', bookId).delete()
        await BookChapter.createMany(
          cleanResult.cleanedChapters.map((chapter, index) => ({
            bookId,
            chapterIndex: index,
            title: chapter.title,
            content: chapter.content,
          }))
        )

        await this.logService.completeStep(semanticStep.id, {
          inputChapters: rawChapters.length,
          keptChapters: cleanResult.cleanedChapters.length,
          droppedChapters: cleanResult.stats.totalDropped,
          isFallback: cleanResult.isFallback,
        })

        // Step 2: dedup checking
        cleanedChapters = cleanResult.cleanedChapters.map((chapter, index) => ({
          title: chapter.title,
          content: chapter.content,
          chapterIndex: index,
        }))
        contentHash = this.hashService.hashNormalizedBook(cleanedChapters)

        await this.logService.advanceRun(runLog.id, BOOK_IMPORT_STEP.DEDUP_CHECKING, 25)
        const dedupStep = await this.logService.startStep(
          runLog.id,
          bookId,
          BOOK_IMPORT_STEP.DEDUP_CHECKING,
          undefined,
          contentHash
        )

        await book
          .merge({
            processingStep: BOOK_IMPORT_STEP.DEDUP_CHECKING,
            processingProgress: 25,
            contentHash,
          })
          .save()
        await pushStatus({
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.DEDUP_CHECKING,
          processingProgress: 25,
          message: 'Checking duplicate content',
        })

        const reusableBook = await Book.query()
          .where('id', '!=', bookId)
          .where('contentHash', contentHash)
          .where('status', 'ready')
          .first()

        if (reusableBook) {
          await this.cloneReusableResult(reusableBook.id, bookId)
          await book
            .merge({
              status: 'ready',
              isPublished: true,
              processingStep: BOOK_IMPORT_STEP.COMPLETED,
              processingProgress: 100,
              processingError: null,
              audioStatus: 'completed',
              vocabularyStatus: 'completed',
              audioUrl: reusableBook.audioUrl,
              audioTiming: reusableBook.audioTiming,
              audioGeneratedAt: reusableBook.audioGeneratedAt,
            })
            .save()

          await this.logService.completeStep(dedupStep.id, {
            reused: true,
            reusedFromBookId: reusableBook.id,
            contentHash,
          })
          await this.logService.completeRun(runLog.id)

          await pushStatus({
            status: 'ready',
            processingStep: BOOK_IMPORT_STEP.COMPLETED,
            processingProgress: 100,
            message: 'Reused existing processed content',
          })
          return
        }

        await pushStatus({
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.DEDUP_CHECKING,
          processingProgress: 30,
          message: 'No reusable content, continue processing',
        })

        await this.logService.completeStep(dedupStep.id, {
          reused: false,
          contentHash,
        })
      }

      // Step 3: persisting vocabulary seed
      const fullContent = cleanedChapters.map((chapter) => chapter.content).join('\n\n')
      if (!contentHash) {
        contentHash = this.hashService.hashNormalizedBook(cleanedChapters)
      }
      const persistInputHash = crypto.createHash('md5').update(fullContent).digest('hex')

      await this.logService.advanceRun(runLog.id, BOOK_IMPORT_STEP.PERSISTING_BOOK, 40)
      const persistStep = await this.logService.startStep(
        runLog.id,
        bookId,
        BOOK_IMPORT_STEP.PERSISTING_BOOK,
        undefined,
        persistInputHash
      )

      await book
        .merge({
          processingStep: BOOK_IMPORT_STEP.PERSISTING_BOOK,
          processingProgress: 40,
        })
        .save()
      await pushStatus({
        status: 'processing',
        processingStep: BOOK_IMPORT_STEP.PERSISTING_BOOK,
        processingProgress: 40,
        message: 'Persisting extracted vocabulary',
      })

      const vocabulary = analyzer.extractVocabulary(fullContent)
      const vocabularyWithMeaning = vocabulary.map((v) => ({
        ...v,
        meaning: '',
        sentence: '',
      }))
      await analyzer.saveVocabulary(bookId, vocabularyWithMeaning)

      await this.logService.completeStep(persistStep.id, {
        vocabularyCount: vocabulary.length,
      })

      // Step 4: dispatch parallel jobs
      const parallelInputHash = crypto
        .createHash('md5')
        .update(`${book.id}:${contentHash}:parallel`)
        .digest('hex')

      await this.logService.advanceRun(runLog.id, BOOK_IMPORT_STEP.PARALLEL_PROCESSING, 45)
      const parallelStep = await this.logService.startStep(
        runLog.id,
        bookId,
        BOOK_IMPORT_STEP.PARALLEL_PROCESSING,
        undefined,
        parallelInputHash
      )

      await book
        .merge({
          processingStep: BOOK_IMPORT_STEP.PARALLEL_PROCESSING,
          processingProgress: 45,
        })
        .save()
      await pushStatus({
        status: 'processing',
        processingStep: BOOK_IMPORT_STEP.PARALLEL_PROCESSING,
        processingProgress: 45,
        message: 'Dispatching audio and vocabulary jobs',
      })

      await Promise.all([
        GenerateBookAudioJob.dispatch({ bookId }),
        GenerateBookVocabularyJob.dispatch({ bookId }),
      ])

      await this.logService.completeStep(parallelStep.id, {
        audioJobDispatched: true,
        vocabularyJobDispatched: true,
      })
      await this.logService.completeRun(runLog.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'ProcessBookJob failed')

      await this.logService.failRun(runLog.id, message)
      await book
        .merge({
          status: 'failed',
          processingStep: BOOK_IMPORT_STEP.FAILED,
          processingProgress: 100,
          processingError: message,
        })
        .save()
      await pushStatus({
        status: 'failed',
        processingStep: BOOK_IMPORT_STEP.FAILED,
        processingProgress: 100,
        message: 'Book processing failed',
        processingError: message,
      })
      throw error
    }
  }

  private computeChaptersHash(chapters: Array<{ title: string; content: string }>): string {
    const payload = chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join('\n---\n')
    return crypto.createHash('md5').update(payload).digest('hex')
  }

  private async cloneReusableResult(fromBookId: number, toBookId: number): Promise<void> {
    const [sourceVocabularies, sourceAudios] = await Promise.all([
      BookVocabulary.query().where('bookId', fromBookId),
      BookChapterAudio.query().where('bookId', fromBookId),
    ])

    await BookVocabulary.query().where('bookId', toBookId).delete()
    await BookChapterAudio.query().where('bookId', toBookId).delete()

    if (sourceVocabularies.length > 0) {
      await BookVocabulary.createMany(
        sourceVocabularies.map((item) => ({
          bookId: toBookId,
          word: item.word,
          lemma: item.lemma,
          frequency: item.frequency,
          meaning: item.meaning,
          sentence: item.sentence,
          phonetic: item.phonetic,
          phoneticText: item.phoneticText,
          phoneticAudio: item.phoneticAudio,
          details: item.details,
        }))
      )
    }

    if (sourceAudios.length > 0) {
      await BookChapterAudio.createMany(
        sourceAudios.map((item) => ({
          bookId: toBookId,
          chapterIndex: item.chapterIndex,
          textHash: item.textHash,
          voiceHash: item.voiceHash,
          audioPath: item.audioPath,
          durationMs: item.durationMs,
          status: item.status,
          errorMessage: item.errorMessage,
        }))
      )
    }
  }
}
