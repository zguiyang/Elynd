import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { BookService } from '#services/book_service'
import { TagService } from '#services/tag_service'
import { BookChatService } from '#services/book_chat_service'
import { listBookValidator } from '#validators/book_validator'
import { bookChatValidator } from '#validators/ai_validator'
import drive from '@adonisjs/drive/services/main'

@inject()
export default class BooksController {
  constructor(
    private bookService: BookService,
    private tagService: TagService,
    private bookChatService: BookChatService
  ) {}

  async index({ request }: HttpContext) {
    const data = await request.validateUsing(listBookValidator)

    const books = await this.bookService.listPublished({
      difficulty: data.difficulty,
      tagId: data.tagId,
      page: data.page,
      perPage: data.perPage,
    })

    return books.serialize()
  }

  async show({ params }: HttpContext) {
    const book = await this.bookService.findPublishedById(params.id)

    return book.serialize()
  }

  async chapter({ params }: HttpContext) {
    const bookId = params.id
    const chapterIndex = params.chapterIndex

    await this.bookService.findPublishedById(bookId)

    const chapter = await this.bookService.getChapterByIndex(bookId, chapterIndex)

    // Get chapter audio info
    const audioInfo = await this.bookService.getChapterAudio(bookId, chapterIndex)

    const serialized = chapter.serialize()

    // Return top-level audio fields instead of nested object
    const audioUrl = audioInfo?.audioPath ?? null
    const audioStatus = audioInfo?.status ?? null
    const audioDurationMs = audioInfo?.durationMs ?? null

    return {
      ...serialized,
      audioUrl,
      audioStatus,
      audioDurationMs,
    }
  }

  async chapterAudio({ params, response }: HttpContext) {
    const bookId = params.id
    const chapterIndex = params.chapterIndex

    // Verify book is published
    await this.bookService.findPublishedById(bookId)

    // Get chapter audio
    const audioInfo = await this.bookService.getChapterAudio(bookId, Number(chapterIndex))

    if (!audioInfo || !audioInfo.audioPath) {
      return response.notFound({ error: 'Chapter audio not found' })
    }

    try {
      const fileBuffer = await drive.use().get(audioInfo.audioPath)

      response.header('Content-Type', 'audio/mpeg')
      response.header('Content-Disposition', `inline; filename="chapter-${chapterIndex}.mp3"`)
      return response.send(fileBuffer)
    } catch {
      return response.notFound({ error: 'Audio file not found' })
    }
  }

  async vocabulary({ params }: HttpContext) {
    const bookId = params.id

    await this.bookService.findPublishedById(bookId)

    const vocabularies = await this.bookService.getVocabularyByBookId(bookId)

    return vocabularies.map((v) => v.serialize())
  }

  async tags({}: HttpContext) {
    const tags = await this.tagService.listAll()

    return tags.map((tag) => tag.serialize())
  }

  async aiChat({ auth, params, request }: HttpContext) {
    const data = await request.validateUsing(bookChatValidator)
    const user = auth.getUserOrFail()

    await this.bookService.findPublishedById(params.id)

    const response = await this.bookChatService.chat({
      userId: user.id,
      bookId: params.id,
      message: data.message,
      bookTitle: data.bookTitle,
      chapterContent: data.chapterContent,
    })

    return { response }
  }
}
