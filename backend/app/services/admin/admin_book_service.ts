import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookService } from '#services/book/book_service'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import { BookLevelService } from '#services/book/book_level_service'
import type { AdminUpdateBookValidator } from '#validators/book_validator'

interface CreateImportedBookInput {
  source: 'user_uploaded' | 'public_domain'
  bookHash: string
  rawFilePath: string
  rawFileName: string
  rawFileExt: string
  rawFileSize: number
  rawFileHash: string
  fallbackTitle: string
  createdBy: number
}

@inject()
export class AdminBookService {
  constructor(
    private bookService: BookService,
    private bookImportOrchestratorService: BookImportOrchestratorService,
    private bookLevelService: BookLevelService
  ) {}

  async createImportedBook(input: CreateImportedBookInput) {
    const defaultLevel = await this.bookLevelService.getDefaultLevel()

    const book = await db.transaction(async (trx) => {
      return Book.create(
        {
          title: input.fallbackTitle,
          author: null,
          description: null,
          source: input.source,
          levelId: defaultLevel.id,
          wordCount: 0,
          readingTime: 1,
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.PREPARE_IMPORT,
          processingProgress: 0,
          processingError: null,
          isPublished: false,
          contentHash: null,
          bookHash: input.bookHash,
          rawFilePath: input.rawFilePath,
          rawFileName: input.rawFileName,
          rawFileExt: input.rawFileExt,
          rawFileSize: input.rawFileSize,
          rawFileHash: input.rawFileHash,
          audioStatus: 'pending',
          vocabularyStatus: 'pending',
          createdBy: input.createdBy,
        },
        { client: trx }
      )
    })

    await this.bookImportOrchestratorService.scheduleImportPipeline({
      bookId: book.id,
      userId: input.createdBy,
    })

    return {
      bookId: book.id,
      status: book.status,
      processingStep: book.processingStep,
      processingProgress: book.processingProgress,
      reused: false,
    }
  }

  async listBooks(page: number, perPage: number) {
    const books = await Book.query()
      .preload('level')
      .orderBy('createdAt', 'desc')
      .paginate(page, perPage)
    const serialized = books.serialize()
    const bookIds = serialized.data.map((book) => book.id)

    if (bookIds.length === 0) {
      return serialized
    }

    const [chapterTotals, completedAudios, failedAudios, pendingAudios, latestRunSummaries] =
      await Promise.all([
        BookChapter.query()
          .whereIn('bookId', bookIds)
          .select('bookId')
          .count('* as total')
          .groupBy('bookId'),
        BookChapterAudio.query()
          .whereIn('bookId', bookIds)
          .where('status', 'completed')
          .select('bookId')
          .count('* as total')
          .groupBy('bookId'),
        BookChapterAudio.query()
          .whereIn('bookId', bookIds)
          .where('status', 'failed')
          .select('bookId')
          .count('* as total')
          .groupBy('bookId'),
        BookChapterAudio.query()
          .whereIn('bookId', bookIds)
          .where('status', 'pending')
          .select('bookId')
          .count('* as total')
          .groupBy('bookId'),
        this.bookService.getLatestRunSummaries(bookIds),
      ])

    const toCountMap = (rows: Array<{ bookId: number; $extras: Record<string, unknown> }>) =>
      rows.reduce<Record<number, number>>((acc, row) => {
        acc[row.bookId] = Number(row.$extras.total || 0)
        return acc
      }, {})

    const chapterTotalsMap = toCountMap(chapterTotals)
    const completedAudiosMap = toCountMap(completedAudios)
    const failedAudiosMap = toCountMap(failedAudios)
    const pendingAudiosMap = toCountMap(pendingAudios)

    serialized.data = serialized.data.map((book) => ({
      ...book,
      latestRun: latestRunSummaries.get(book.id) || null,
      chapterAudioSummary: {
        total: chapterTotalsMap[book.id] ?? 0,
        completed: completedAudiosMap[book.id] ?? 0,
        pending: pendingAudiosMap[book.id] ?? 0,
        failed: failedAudiosMap[book.id] ?? 0,
      },
    }))

    return serialized
  }

  async updateBook(id: number, data: AdminUpdateBookValidator) {
    const book = await this.findEditableBook(id)

    if (data.title !== undefined) {
      book.title = data.title
    }
    if (data.author !== undefined) {
      book.author = data.author
    }
    if (data.description !== undefined) {
      book.description = data.description
    }
    if (data.levelId !== undefined) {
      book.levelId = data.levelId
    }
    if (data.source !== undefined) {
      book.source = data.source
    }

    await book.save()
    return book.serialize()
  }

  async deleteBook(id: number) {
    const book = await this.findEditableBook(id)
    await book.delete()
  }

  private async findEditableBook(id: number) {
    const book = await Book.find(id)
    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }
    if (book.status === 'processing') {
      throw new Exception('Book is processing, operation not allowed', { status: 400 })
    }

    return book
  }
}
