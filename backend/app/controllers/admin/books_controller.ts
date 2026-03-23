import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import drive from '@adonisjs/drive/services/main'
import { extname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BookService } from '#services/book/book_service'
import { AdminBookService } from '#services/admin/admin_book_service'
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

@inject()
export default class AdminBooksController {
  constructor(
    private bookService: BookService,
    private adminBookService: AdminBookService,
    private bookParserService: BookParserService,
    private bookHashService: BookHashService
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

    return this.adminBookService.createImportedBook({
      source: data.source,
      bookHash: data.bookHash,
      rawFilePath: relativePath,
      rawFileName: file.clientName,
      rawFileExt: fileExt,
      rawFileSize: file.size ?? rawBuffer.length,
      rawFileHash,
      fallbackTitle,
      createdBy: user.id,
    })
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

    return this.adminBookService.listBooks(page, perPage)
  }

  async update({ params, request }: HttpContext) {
    const idData = await request.validateUsing(adminBookIdValidator, {
      data: { id: params.id },
    })

    const data = await request.validateUsing(adminUpdateBookValidator)
    return this.adminBookService.updateBook(idData.id, data)
  }

  async destroy({ params, request }: HttpContext) {
    const idData = await request.validateUsing(adminBookIdValidator, {
      data: { id: params.id },
    })

    await this.adminBookService.deleteBook(idData.id)

    return {}
  }
}
