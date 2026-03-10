import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import { VocabularyAnalyzerService } from '#services/vocabulary_analyzer_service'
import { TransmitService } from '#services/transmit_service'

interface ProcessBookPayload {
  bookId: number
  userId: number
}

export default class ProcessBookJob extends Job {
  static get concurrency() {
    return 2
  }

  async handle(payload: ProcessBookPayload) {
    const { bookId, userId } = payload
    const book = await Book.find(bookId)

    if (!book) {
      throw new Error(`Book ${bookId} not found`)
    }

    const transmitService = await app.container.make(TransmitService)
    const analyzer = await app.container.make(VocabularyAnalyzerService)
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
      await book
        .merge({
          status: 'processing',
          processingStep: 'analyzing_vocabulary',
          processingProgress: 20,
          processingError: null,
        })
        .save()

      await pushStatus({
        status: 'processing',
        processingStep: 'analyzing_vocabulary',
        processingProgress: 20,
        message: 'Analyzing vocabulary',
      })

      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
      const fullContent = chapters.map((chapter) => chapter.content).join('\n\n')
      const vocabulary = analyzer.extractVocabulary(fullContent)

      await book
        .merge({
          processingStep: 'generating_meanings',
          processingProgress: 50,
        })
        .save()

      await pushStatus({
        status: 'processing',
        processingStep: 'generating_meanings',
        processingProgress: 50,
        message: 'Generating meanings',
      })

      const withMeanings = await analyzer.generateMeaningsWithAI(book.title, vocabulary)
      await analyzer.saveVocabulary(bookId, withMeanings)

      await book
        .merge({
          processingStep: 'generating_audio',
          processingProgress: 80,
        })
        .save()

      await pushStatus({
        status: 'processing',
        processingStep: 'generating_audio',
        processingProgress: 80,
        message: 'Queuing audio generation',
      })

      await GenerateBookAudioJob.dispatch({ bookId })

      await book
        .merge({
          status: 'ready',
          processingStep: 'completed',
          processingProgress: 100,
          processingError: null,
        })
        .save()

      await pushStatus({
        status: 'ready',
        processingStep: 'completed',
        processingProgress: 100,
        message: 'Book processing completed',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, bookId }, 'ProcessBookJob failed')

      await book
        .merge({
          status: 'failed',
          processingError: message,
        })
        .save()

      await pushStatus({
        status: 'failed',
        processingStep: book.processingStep || 'unknown',
        processingProgress: book.processingProgress || 0,
        message: 'Book processing failed',
        processingError: message,
      })

      throw error
    }
  }
}
