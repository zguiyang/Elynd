import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { BookService } from '#services/book_service'
import { TagService } from '#services/tag_service'
import { BookChatService } from '#services/book_chat_service'
import { listBookValidator } from '#validators/book_validator'
import { bookChatValidator } from '#validators/ai_validator'

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

    return chapter.serialize()
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
