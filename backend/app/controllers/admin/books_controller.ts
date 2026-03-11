import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { dispatch } from 'adonisjs-jobs/services/main'
import GenerateBookJob from '#jobs/generate_book_job'
import ProcessBookJob from '#jobs/process_book_job'
import { BookService } from '#services/book_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import db from '@adonisjs/lucid/services/db'
import { TransmitService } from '#services/transmit_service'
import { BookParserService } from '#services/book_parser_service'
import { BookChapterCleanerService } from '#services/book_chapter_cleaner_service'
import { BookHashService } from '#services/book_hash_service'
import {
  generateBookValidator,
  importBookValidator,
  queryBookStatusValidator,
} from '#validators/book_validator'

@inject()
export default class AdminBooksController {
  constructor(
    private transmitService: TransmitService,
    private bookService: BookService,
    private bookParserService: BookParserService
  ) {
    this.bookChapterCleanerService = new BookChapterCleanerService()
    this.bookHashService = new BookHashService()
  }

  private bookChapterCleanerService: BookChapterCleanerService
  private bookHashService: BookHashService

  async generate({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(generateBookValidator)

    logger.info(
      { userId: user.id, difficultyLevel: data.difficultyLevel, topic: data.topic },
      'Book generation requested'
    )

    const jobId = (await dispatch(GenerateBookJob, {
      userId: user.id,
      difficultyLevel: data.difficultyLevel,
      topic: data.topic,
      extraInstructions: data.extraInstructions,
    })) as string | undefined

    const resolvedJobId = jobId || `manual-${Date.now()}`

    await this.transmitService.toUser(`user:${user.id}:book`, 'book:status', {
      jobId: resolvedJobId,
      status: 'queued',
      progress: 0,
      message: 'Added to generation queue',
    })

    return { jobId: resolvedJobId, status: 'queued' }
  }

  async retryAudio({ params }: HttpContext) {
    logger.info({ bookId: params.id }, 'Audio retry requested')

    const result = await this.bookService.retryAudioGeneration(params.id)

    return {
      success: true,
      message: 'Audio retry task added to queue',
      ...result,
    }
  }

  async parse({ request }: HttpContext) {
    const file = request.file('file', {
      extnames: ['epub', 'txt'],
      size: '4mb',
    })

    if (!file) {
      return { errors: [{ message: 'File is required' }] }
    }

    if (file.hasErrors) {
      return { errors: file.errors }
    }

    const parsed = await this.bookParserService.parseFile(file)

    return {
      fileName: file.clientName,
      ...parsed,
    }
  }

  async import({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(importBookValidator)

    // Clean chapters before persistence
    const cleanResult = this.bookChapterCleanerService.clean(data.chapters)

    // Compute content hash
    const contentHash = this.bookHashService.hashNormalizedBook(cleanResult.cleanedChapters)

    // Detect reusable completed book by content_hash
    const existingBook = await Book.query()
      .where('contentHash', contentHash)
      .where('status', 'ready')
      .first()

    if (existingBook) {
      logger.info({ bookId: existingBook.id, contentHash }, 'Reusing existing completed book')

      return {
        bookId: existingBook.id,
        status: existingBook.status,
        processingStep: existingBook.processingStep,
        processingProgress: existingBook.processingProgress,
        reused: true,
        message: 'Book already processed, returning existing book',
      }
    }

    // Create new book with cleaned chapters
    const book = await db.transaction(async (trx) => {
      const created = await Book.create(
        {
          title: data.title,
          author: data.author || null,
          description: data.description || null,
          source: data.source,
          difficultyLevel: data.difficultyLevel,
          wordCount: data.wordCount,
          readingTime: Math.max(1, Math.ceil(data.wordCount / 200)),
          status: 'processing',
          processingStep: 'parsing',
          processingProgress: 0,
          processingError: null,
          isPublished: false,
          contentHash,
          createdBy: user.id,
        },
        { client: trx }
      )

      await BookChapter.createMany(
        cleanResult.cleanedChapters.map((chapter) => ({
          bookId: created.id,
          chapterIndex: chapter.chapterIndex,
          title: chapter.title,
          content: chapter.content,
        })),
        { client: trx }
      )

      return created
    })

    await dispatch(ProcessBookJob, {
      bookId: book.id,
      userId: user.id,
    })

    return {
      bookId: book.id,
      status: book.status,
      processingStep: book.processingStep,
      processingProgress: book.processingProgress,
      reused: false,
    }
  }

  async status({ params, request }: HttpContext) {
    await request.validateUsing(queryBookStatusValidator, {
      data: { id: params.id },
    })

    // Use enriched status to include run diagnostics and chapter audio summary
    const enrichedStatus = await this.bookService.getEnrichedStatus(params.id)

    return enrichedStatus
  }
}
