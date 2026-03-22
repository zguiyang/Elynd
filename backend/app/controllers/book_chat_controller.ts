import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { BookChatService } from '#services/book/book_chat_service'
import { BookService } from '#services/book/book_service'
import { bookChatValidator } from '#validators/book_chat_validator'
import { createSseWriter } from '#utils/sse'

@inject()
export default class BookChatController {
  constructor(
    private bookChatService: BookChatService,
    private bookService: BookService
  ) {}

  async chat({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(bookChatValidator, {
      data: request.qs(),
    })
    const bookId = params.id
    const user = auth.getUserOrFail()
    const userId = user.id
    const message = data.message
    const actionType = data.actionType
    const chapterIndex = data.chapterIndex
    await this.bookService.findReadableBookById(bookId, { isAdmin: user.isAdmin })

    const sse = createSseWriter({ request, response } as HttpContext)
    sse.comment('connected')

    // Create AbortController to cancel AI request on client disconnect
    const abortController = new AbortController()

    // Abort AI request when client disconnects
    sse.onClose(() => {
      abortController.abort()
    })

    await this.bookChatService.streamChat(
      {
        userId,
        bookId,
        isAdmin: user.isAdmin,
        message,
        actionType,
        chapterIndex,
      },
      {
        onChunk: (chunkData) => {
          if (sse.isClosed()) return
          if (!chunkData.isComplete) {
            sse.send({ type: 'chunk', content: chunkData.delta })
          }
        },
        onComplete: (completeData) => {
          if (sse.isClosed()) return
          sse.send({ type: 'done', content: completeData.content, usage: completeData.usage })
          sse.close()
        },
        onError: () => {
          if (sse.isClosed()) return
          sse.send({ type: 'error', message: 'Request failed' })
          sse.close()
        },
        isAborted: () => abortController.signal.aborted,
      },
      abortController.signal
    )
  }
}
