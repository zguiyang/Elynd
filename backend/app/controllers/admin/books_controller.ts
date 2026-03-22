import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import { extname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BookService } from '#services/book/book_service'
import { BookImportOrchestratorService } from '#services/book-import/book_import_orchestrator_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChapterAudio from '#models/book_chapter_audio'
import db from '@adonisjs/lucid/services/db'
import { BookParserService } from '#services/book-parse/book_parser_service'
import {
  importBookValidator,
  queryBookStatusValidator,
  adminListBooksValidator,
  adminBookIdValidator,
  adminUpdateBookValidator,
} from '#validators/book_validator'
import { Exception } from '@adonisjs/core/exceptions'
import { BookHashService } from '#services/book-parse/book_hash_service'
import { BOOK_IMPORT_STEP } from '#constants'
import { BookLevelService } from '#services/book/book_level_service'

@inject()
export default class AdminBooksController {
  constructor(
    private bookService: BookService,
    private bookParserService: BookParserService,
    private bookImportOrchestratorService: BookImportOrchestratorService,
    private bookHashService: BookHashService,
    private bookLevelService: BookLevelService
  ) {}

  async retryAudio({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info({ bookId: params.id, userId: user.id }, 'Audio retry requested')

    const result = await this.bookService.retryAudioGeneration(params.id, user.id)

    return {
      message: 'Audio retry task added to queue',
      ...result,
    }
  }

  async retryVocabulary({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info({ bookId: params.id, userId: user.id }, 'Vocabulary retry requested')

    const result = await this.bookService.retryVocabularyGeneration(params.id, user.id)

    return {
      message: 'Vocabulary retry task added to queue',
      ...result,
    }
  }

  async rebuildChapters({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info({ bookId: params.id }, 'Chapter rebuild requested')

    const result = await this.bookService.rebuildChapters(params.id, user.id)

    return {
      message: 'Chapter rebuild task added to queue',
      ...result,
    }
  }

  async stopImport({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info({ bookId: params.id, userId: user.id }, 'Import stop requested')

    const result = await this.bookService.stopImport(params.id, user.id)

    return {
      message: `Import flow stopped, removed ${result.removedQueuedJobs} queued jobs`,
      ...result,
    }
  }

  async continueImport({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    logger.info({ bookId: params.id, userId: user.id }, 'Import continue requested')

    const result = await this.bookService.continueImport(params.id, user.id)

    return {
      message: `Import resumed from step: ${result.resumeStep}`,
      ...result,
    }
  }

  async import({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(importBookValidator)
    const file = request.file('file', {
      extnames: ['epub'],
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
    const uniqueBaseName = `${Date.now()}-${randomUUID()}`
    const storageFileName = `${uniqueBaseName}.${fileExt}`
    const relativePath = `book/raw/${storageFileName}`

    await file.moveToDisk(relativePath)

    if (file.hasErrors) {
      throw new Exception(file.errors[0]?.message || 'Failed to store upload file', { status: 500 })
    }

    const rawBuffer = await drive.use().get(relativePath)
    const rawFileHash = this.bookHashService.hashRawFile(rawBuffer)
    const fallbackTitle = basename(file.clientName, extname(file.clientName)) || 'Untitled'
    const defaultLevel = await this.bookLevelService.getDefaultLevel()

    const book = await db.transaction(async (trx) => {
      return await Book.create(
        {
          title: fallbackTitle,
          author: null,
          description: null,
          source: data.source,
          levelId: defaultLevel.id,
          wordCount: 0,
          readingTime: 1,
          status: 'processing',
          processingStep: BOOK_IMPORT_STEP.PREPARE_IMPORT,
          processingProgress: 0,
          processingError: null,
          isPublished: false,
          contentHash: null,
          bookHash: data.bookHash,
          rawFilePath: relativePath,
          rawFileName: file.clientName,
          rawFileExt: fileExt,
          rawFileSize: file.size ?? rawBuffer.length,
          rawFileHash,
          audioStatus: 'pending',
          vocabularyStatus: 'pending',
          createdBy: user.id,
        },
        { client: trx }
      )
    })

    await this.bookImportOrchestratorService.scheduleImportPipeline({
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
    if (data.levelId !== undefined) {
      book.levelId = data.levelId
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

    return {}
  }
}
