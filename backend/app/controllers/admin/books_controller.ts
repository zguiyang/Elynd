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
  ) {}

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
          isPublished: true,
          createdBy: user.id,
        },
        { client: trx }
      )

      await BookChapter.createMany(
        data.chapters.map((chapter, index) => ({
          bookId: created.id,
          chapterIndex: index,
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
    }
  }

  async status({ params, request }: HttpContext) {
    await request.validateUsing(queryBookStatusValidator, {
      data: { id: params.id },
    })

    const book = await this.bookService.findById(params.id)

    return {
      id: book.id,
      status: book.status,
      processingStep: book.processingStep,
      processingProgress: book.processingProgress,
      processingError: book.processingError,
    }
  }
}
