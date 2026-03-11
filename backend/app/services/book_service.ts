import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import BookChapterAudio from '#models/book_chapter_audio'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import type { ListPublishedParams } from '#types/book'

@inject()
export class BookService {
  async listPublished(params: ListPublishedParams) {
    const query = Book.query()
      .where('isPublished', true)
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'bookId', 'chapterIndex', 'title')
      })

    if (params.difficulty) {
      query.where('difficultyLevel', params.difficulty)
    }

    if (params.tagId) {
      const tagId = params.tagId
      query.whereHas('tags', (tagQuery) => {
        tagQuery.where('id', tagId)
      })
    }

    return query.orderBy('createdAt', 'desc').paginate(params.page || 1, params.perPage || 20)
  }

  async findPublishedById(id: number) {
    const book = await this.buildBookQuery(true).where('id', id).first()

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    return book
  }

  async findById(id: number) {
    const book = await this.buildBookQuery(false).where('id', id).first()

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    return book
  }

  private buildBookQuery(requirePublished: boolean) {
    const query = Book.query()
      .preload('tags')
      .preload('chapters', (chapterQuery) => {
        chapterQuery.select('id', 'bookId', 'chapterIndex', 'title')
      })

    if (requirePublished) {
      query.where('isPublished', true)
    }

    return query
  }

  async getChapterByIndex(bookId: number, chapterIndex: number) {
    const chapter = await BookChapter.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .first()

    if (!chapter) {
      throw new Exception('Chapter not found', { status: 404 })
    }

    return chapter
  }

  async getVocabularyByBookId(bookId: number) {
    const vocabularies = await BookVocabulary.query().where('bookId', bookId).orderBy('id', 'asc')

    return vocabularies
  }

  async retryAudioGeneration(bookId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.audioStatus !== 'failed') {
      throw new Exception('Can only retry books with failed audio status', { status: 400 })
    }

    await db.transaction(async (trx) => {
      await book.useTransaction(trx).merge({ audioStatus: 'pending' }).save()
    })

    await GenerateBookAudioJob.dispatch({ bookId: book.id })

    return {
      bookId: book.id,
      status: 'pending',
    }
  }

  /**
   * Get chapter audio metadata for a specific chapter
   */
  async getChapterAudio(bookId: number, chapterIndex: number) {
    const audio = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .where('status', 'completed')
      .first()

    if (!audio) {
      return null
    }

    return {
      chapterIndex: audio.chapterIndex,
      audioPath: audio.audioPath,
      durationMs: audio.durationMs,
      status: audio.status,
    }
  }

  /**
   * Get all chapter audios for a book
   */
  async getAllChapterAudios(bookId: number) {
    const audios = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .orderBy('chapterIndex', 'asc')

    return audios.map((audio) => ({
      chapterIndex: audio.chapterIndex,
      audioPath: audio.audioPath,
      durationMs: audio.durationMs,
      status: audio.status,
    }))
  }

  /**
   * Check if all chapters have completed audio
   */
  async areAllChaptersReady(bookId: number): Promise<boolean> {
    const totalChapters = await BookChapter.query()
      .where('bookId', bookId)
      .count('* as total')

    const chapterCount = Number(totalChapters[0].$extras.total)

    if (chapterCount === 0) {
      return false
    }

    const completedAudios = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .count('* as total')

    const completedCount = Number(completedAudios[0].$extras.total)

    return completedCount === chapterCount
  }
}
