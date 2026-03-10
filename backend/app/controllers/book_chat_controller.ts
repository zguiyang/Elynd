import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { PassThrough } from 'node:stream'
import { BookChatService } from '#services/book_chat_service'
import { bookChatValidator } from '#validators/book_chat_validator'

@inject()
export default class BookChatController {
  constructor(private bookChatService: BookChatService) {}

  async chat({ params, request, response, auth }: HttpContext) {
    const data = await request.validateUsing(bookChatValidator, {
      data: request.qs(),
    })
    const bookId = params.id
    const user = auth.getUserOrFail()
    const userId = user.id
    const message = data.message
    const chapterIndex = data.chapterIndex

    const stream = new PassThrough()

    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    response.header('X-Accel-Buffering', 'no')

    const streamed = response.stream(stream)

    await this.bookChatService.streamChat(
      {
        userId,
        bookId,
        message,
        chapterIndex,
      },
      {
        onChunk: (chunkData) => {
          if (!chunkData.isComplete) {
            stream.write(`data: ${JSON.stringify({ type: 'chunk', content: chunkData.delta })}\n\n`)
          } else {
            stream.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`)
          }
        },
        onComplete: (completeData) => {
          stream.write(
            `data: ${JSON.stringify({ type: 'done', content: completeData.content, usage: completeData.usage })}\n\n`
          )
          stream.end()
        },
        onError: (error) => {
          stream.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
          stream.end()
        },
      }
    )

    return streamed
  }
}
