import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { BookGenerationService } from '#services/book/book_generation_service'
import { TransmitService } from '#services/shared/transmit_service'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import GenerateBookVocabularyJob from '#jobs/generate_book_vocabulary_job'

interface GenerateBookPayload {
  userId: number
  difficultyLevel: string
  topic: string
  extraInstructions?: string
}

interface BookStatusData {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message: string
  book?: any
  error?: string
}

export default class GenerateBookJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateBookPayload) {
    const jobId = String(this.job.id)
    const { userId, difficultyLevel, topic } = payload
    const channel = `user:${userId}:book`

    const bookService = await app.container.make(BookGenerationService)
    const transmitService = await app.container.make(TransmitService)

    const sendStatus = async (data: BookStatusData) => {
      await transmitService.toUser(channel, 'book:status', data)
    }

    try {
      await sendStatus({
        jobId,
        status: 'processing',
        progress: 30,
        message: '正在生成文章内容...',
      })

      const book = await bookService.generateBook(userId, {
        difficultyLevel,
        topic,
      })

      await sendStatus({
        jobId,
        status: 'processing',
        progress: 60,
        message: '正在处理标签...',
      })

      await sendStatus({
        jobId,
        status: 'processing',
        progress: 90,
        message: '正在保存...',
      })

      await book.load('tags')
      await book.load('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'bookId', 'chapterIndex', 'title')
      })

      await book.merge({ audioStatus: 'pending' }).save()

      await GenerateBookAudioJob.dispatch({ bookId: book.id })
      await GenerateBookVocabularyJob.dispatch({ bookId: book.id })

      await sendStatus({
        jobId,
        status: 'completed',
        progress: 100,
        message: '生成完成',
        book: {
          id: book.id,
          title: book.title,
          difficultyLevel: book.difficultyLevel,
          wordCount: book.wordCount,
          readingTime: book.readingTime,
          tags: book.tags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
          chapters: book.chapters.map((c) => ({
            id: c.id,
            chapterIndex: c.chapterIndex,
            title: c.title,
          })),
          createdAt: book.createdAt,
        },
      })

      logger.info({ userId, bookId: book.id }, 'Book generation completed')
    } catch (error) {
      logger.error({ err: error, jobId }, 'GenerateBookJob failed')

      // Attempt to send failure notification, ensure SSE errors don't swallow the original error
      try {
        await sendStatus({
          jobId,
          status: 'failed',
          progress: 0,
          message: '生成失败',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } catch (sseError) {
        // Log SSE send failure but don't block original error from being thrown
        logger.error(
          { err: sseError, jobId, originalError: error },
          'Failed to send SSE failure notification'
        )
      }

      throw error
    }
  }
}
