import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import { dispatch } from 'adonisjs-jobs/services/main'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import GenerateBookJob from '#jobs/generate_book_job'
import ProcessBookJob from '#jobs/process_book_job'
import { BookService } from '#services/book_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import db from '@adonisjs/lucid/services/db'
import { TransmitService } from '#services/transmit_service'
import { BookParserService } from '#services/book_parser_service'
import {
  generateBookValidator,
  importBookValidator,
  queryBookStatusValidator,
  adminListBooksValidator,
  adminBookIdValidator,
  adminUpdateBookValidator,
} from '#validators/book_validator'
import { Exception } from '@adonisjs/core/exceptions'
import { BookHashService } from '#services/book_hash_service'

@inject()
export default class AdminBooksController {
  private readonly hashService = new BookHashService()

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

  async retryVocabulary({ params }: HttpContext) {
    logger.info({ bookId: params.id }, 'Vocabulary retry requested')

    const result = await this.bookService.retryVocabularyGeneration(params.id)

    return {
      success: true,
      message: 'Vocabulary retry task added to queue',
      ...result,
    }
  }

  async import({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(importBookValidator)
    const file = request.file('file', {
      extnames: ['epub', 'txt'],
      size: '4mb',
    })

    if (!file) {
      throw new Exception('File is required', { status: 400 })
    }

    if (file.hasErrors) {
      throw new Exception(file.errors[0]?.message || 'Invalid upload file', { status: 400 })
    }

    this.bookParserService.validateFile(file)

    if (!file.tmpPath) {
      throw new Exception('Upload temp file not found', { status: 400 })
    }

    const fileExt = (file.extname || extname(file.clientName).replace('.', '')).toLowerCase()
    const storageDir = join(process.cwd(), 'storage', 'book', 'raw')
    await mkdir(storageDir, { recursive: true })

    const uniqueBaseName = `${Date.now()}-${randomUUID()}`
    const storageFileName = `${uniqueBaseName}.${fileExt}`
    const storagePath = join(storageDir, storageFileName)
    const relativePath = `book/raw/${storageFileName}`

    await copyFile(file.tmpPath, storagePath)
    const rawBuffer = await readFile(storagePath)
    const rawFileHash = this.hashService.hashRawFile(rawBuffer)
    const fallbackTitle = basename(file.clientName, extname(file.clientName)) || 'Untitled'

    const book = await db.transaction(async (trx) => {
      return await Book.create(
        {
          title: fallbackTitle,
          author: null,
          description: null,
          source: data.source,
          difficultyLevel: 'L1',
          wordCount: 0,
          readingTime: 1,
          status: 'processing',
          processingStep: 'import_received',
          processingProgress: 0,
          processingError: null,
          isPublished: false,
          contentHash: null,
          bookHash: data.bookHash,
          rawFilePath: relativePath,
          rawFileName: file.clientName,
          rawFileExt: fileExt,
          rawFileSize: file.size ?? 0,
          rawFileHash,
          audioStatus: 'pending',
          vocabularyStatus: 'pending',
          createdBy: user.id,
        },
        { client: trx }
      )
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

  async index({ request }: HttpContext) {
    const data = await request.validateUsing(adminListBooksValidator)

    const page = data.page || 1
    const perPage = data.perPage || 20

    const books = await Book.query().orderBy('createdAt', 'desc').paginate(page, perPage)

    const serialized = books.serialize()
    const bookIds = serialized.data.map((book) => book.id)

    if (bookIds.length === 0) {
      return serialized
    }

    const [chapterTotals, completedAudios, failedAudios, pendingAudios] = await Promise.all([
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
      chapterAudioSummary: {
        total: chapterTotalsMap[book.id] ?? 0,
        completed: completedAudiosMap[book.id] ?? 0,
        pending: pendingAudiosMap[book.id] ?? 0,
        failed: failedAudiosMap[book.id] ?? 0,
      },
    }))

    return serialized
  }

  async update({ params, request }: HttpContext) {
    const idData = await request.validateUsing(adminBookIdValidator, {
      data: { id: params.id },
    })

    const data = await request.validateUsing(adminUpdateBookValidator)

    const book = await Book.find(idData.id)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.status === 'processing') {
      throw new Exception('Book is processing, operation not allowed', { status: 400 })
    }

    // Merge allowed fields only
    if (data.title !== undefined) {
      book.title = data.title
    }
    if (data.author !== undefined) {
      book.author = data.author
    }
    if (data.description !== undefined) {
      book.description = data.description
    }
    if (data.difficultyLevel !== undefined) {
      book.difficultyLevel = data.difficultyLevel
    }
    if (data.source !== undefined) {
      book.source = data.source
    }

    await book.save()

    return book.serialize()
  }

  async destroy({ params, request }: HttpContext) {
    const idData = await request.validateUsing(adminBookIdValidator, {
      data: { id: params.id },
    })

    const book = await Book.find(idData.id)

    if (!book) {
      throw new Exception('Book not found', { status: 404 })
    }

    if (book.status === 'processing') {
      throw new Exception('Book is processing, operation not allowed', { status: 400 })
    }

    await book.delete()

    return { success: true }
  }
}
