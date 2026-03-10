import { DateTime } from 'luxon'
import { Job } from 'adonisjs-jobs'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import { TtsService } from '#services/tts_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import type { ChapterInput } from '#types/tts'

interface GenerateBookAudioPayload {
  bookId: number
}

export default class GenerateBookAudioJob extends Job {
  static get concurrency() {
    return 1
  }

  async handle(payload: GenerateBookAudioPayload) {
    const { bookId } = payload

    logger.info({ bookId }, 'Starting audio generation')

    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception(`Book ${bookId} not found`, { status: 404 })
    }

    try {
      await book.merge({ audioStatus: 'processing' }).save()

      const chapters = await BookChapter.query()
        .where('bookId', bookId)
        .orderBy('chapterIndex', 'asc')
        .select(['chapterIndex', 'title', 'content'])

      const chapterInputs: ChapterInput[] = chapters.map((chapter) => ({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        content: chapter.content,
      }))

      const ttsService = await app.container.make(TtsService)

      const result = await ttsService.generateAudio(chapterInputs, bookId)

      await book
        .merge({
          audioUrl: result.audioUrl,
          audioStatus: 'completed',
          audioTiming: result.timing as unknown as Record<string, unknown> | null,
          audioGeneratedAt: DateTime.now(),
        })
        .save()

      logger.info({ bookId }, 'Audio generation completed')
    } catch (error) {
      logger.error({ err: error, bookId }, 'Audio generation failed')

      if (book) {
        await book.merge({ audioStatus: 'failed' }).save()
      }

      throw error
    }
  }
}
