import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookVocabulary from '#models/book_vocabulary'
import BookChapterAudio from '#models/book_chapter_audio'
import BookProcessingRunLog from '#models/book_processing_run_log'
import GenerateBookAudioJob from '#jobs/generate_book_audio_job'
import GenerateBookVocabularyJob from '#jobs/generate_book_vocabulary_job'
import type { ListPublishedParams } from '#types/book'

export interface ChapterAudioSummary {
  total: number
  completed: number
  pending: number
  failed: number
}

export interface VocabularySummary {
  total: number
  completed: number
  pending: number
  failed: number
}

export interface EnrichedBookStatus {
  id: number
  status: string
  processingStep: string | null
  processingProgress: number
  processingError: string | null
  bookHash: string | null
  audioStatus: string | null
  vocabularyStatus: string
  latestRun: {
    id: number
    jobType: string
    status: string
    currentStep: string | null
    progress: number
    startedAt: string | null
    finishedAt: string | null
    errorCode: string | null
    errorMessage: string | null
  } | null
  chapterAudioSummary: ChapterAudioSummary
  vocabularySummary: VocabularySummary
}

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

  async retryVocabularyGeneration(bookId: number) {
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.vocabularyStatus !== 'failed') {
      throw new Exception('Can only retry books with failed vocabulary status', { status: 400 })
    }

    await db.transaction(async (trx) => {
      await book.useTransaction(trx).merge({ vocabularyStatus: 'pending' }).save()
    })

    await GenerateBookVocabularyJob.dispatch({ bookId: book.id })

    return {
      bookId: book.id,
      vocabularyStatus: 'pending',
    }
  }

  /**
   * Get chapter audio metadata for a specific chapter
   */
  async getChapterAudio(bookId: number, chapterIndex: number) {
    const audio = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('chapterIndex', chapterIndex)
      .orderBy('updatedAt', 'desc')
      .first()

    if (!audio) {
      return null
    }

    // Only return audioPath and durationMs for completed status
    const isCompleted = audio.status === 'completed'

    return {
      chapterIndex: audio.chapterIndex,
      audioPath: isCompleted ? audio.audioPath : null,
      durationMs: isCompleted ? audio.durationMs : null,
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
    const totalChapters = await BookChapter.query().where('bookId', bookId).count('* as total')

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

  /**
   * Get enriched book status with run diagnostics and chapter audio summary
   */
  async getEnrichedStatus(bookId: number): Promise<EnrichedBookStatus> {
    // Get basic book info
    const book = await Book.find(bookId)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    // Get latest run log
    const latestRun = await BookProcessingRunLog.query()
      .where('bookId', bookId)
      .orderBy('startedAt', 'desc')
      .first()

    // Get chapter audio summary
    const totalChaptersResult = await BookChapter.query()
      .where('bookId', bookId)
      .count('* as total')

    const totalChapters = Number(totalChaptersResult[0].$extras.total)

    const completedAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'completed')
      .count('* as total')

    const completedCount = Number(completedAudiosResult[0].$extras.total)

    const failedAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'failed')
      .count('* as total')

    const failedCount = Number(failedAudiosResult[0].$extras.total)

    const pendingAudiosResult = await BookChapterAudio.query()
      .where('bookId', bookId)
      .where('status', 'pending')
      .count('* as total')

    const pendingCount = Number(pendingAudiosResult[0].$extras.total)

    // Get vocabulary summary
    const totalVocabResult = await BookVocabulary.query()
      .where('bookId', bookId)
      .count('* as total')

    const totalVocab = Number(totalVocabResult[0].$extras.total)

    // Compute vocabulary counts based on book-level vocabularyStatus
    let vocabCompleted = 0
    let vocabPending = 0
    let vocabFailed = 0

    if (book.vocabularyStatus === 'completed') {
      vocabCompleted = totalVocab
      vocabPending = 0
      vocabFailed = 0
    } else if (book.vocabularyStatus === 'failed') {
      vocabCompleted = 0
      vocabPending = 0
      vocabFailed = totalVocab
    } else {
      // pending or processing
      vocabCompleted = 0
      vocabPending = totalVocab
      vocabFailed = 0
    }

    return {
      id: book.id,
      status: book.status,
      processingStep: book.processingStep,
      processingProgress: book.processingProgress,
      processingError: book.processingError,
      bookHash: book.bookHash,
      audioStatus: book.audioStatus,
      vocabularyStatus: book.vocabularyStatus,
      latestRun: latestRun
        ? {
            id: latestRun.id,
            jobType: latestRun.jobType,
            status: latestRun.status,
            currentStep: latestRun.currentStep,
            progress: latestRun.progress,
            startedAt: latestRun.startedAt ? latestRun.startedAt.toISO() : null,
            finishedAt: latestRun.finishedAt ? latestRun.finishedAt.toISO() : null,
            errorCode: latestRun.errorCode,
            errorMessage: latestRun.errorMessage,
          }
        : null,
      chapterAudioSummary: {
        total: totalChapters,
        completed: completedCount,
        pending: pendingCount,
        failed: failedCount,
      },
      vocabularySummary: {
        total: totalVocab,
        completed: vocabCompleted,
        pending: vocabPending,
        failed: vocabFailed,
      },
    }
  }
}
