import { inject } from '@adonisjs/core'
import { AiService } from '#services/ai_service'
import { ConfigService } from '#services/config_service'
import { UserConfigService } from '#services/user_config_service'
import PromptService from '#services/prompt_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChat from '#models/book_chat'
import logger from '@adonisjs/core/services/logger'

export interface ChatParams {
  userId: number
  bookId: number
  message: string
  chapterIndex?: number | undefined
}

export interface StreamHandlers {
  onChunk: (data: { delta: string; isComplete: boolean }) => void
  onComplete: (data: {
    content: string
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  }) => void
  onError: (error: Error) => void
}

export interface SimpleChatParams {
  userId: number
  bookId: number
  message: string
  bookTitle?: string
  chapterContent?: string
}

@inject()
export class BookChatService {
  constructor(
    private aiService: AiService,
    private configService: ConfigService,
    private userConfigService: UserConfigService,
    private promptService: PromptService
  ) {}

  async chat(params: SimpleChatParams): Promise<string> {
    const { userId, bookId, message, bookTitle, chapterContent } = params

    const [userConfig, book] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      Book.findOrFail(bookId),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'

    const systemPrompt = this.promptService.render('book/chat', {
      nativeLanguage,
      targetLanguage,
      bookTitle: bookTitle || book.title,
      chapterTitle: undefined,
      chapterContent: chapterContent || undefined,
      userMessage: message,
    })

    const aiConfig = await this.configService.getAiConfig()

    return await this.aiService.chat(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      maxTokens: 1000,
    })
  }

  async streamChat(params: ChatParams, handlers: StreamHandlers): Promise<void> {
    const { userId, bookId, message, chapterIndex } = params

    const [userConfig, book] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      Book.findOrFail(bookId),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'

    let chapterTitle: string | undefined
    let chapterContent: string | undefined

    if (chapterIndex !== undefined) {
      const chapter = await BookChapter.query()
        .where('book_id', bookId)
        .where('chapter_index', chapterIndex)
        .first()

      if (chapter) {
        chapterTitle = chapter.title
        chapterContent = chapter.content
      }
    }

    const systemPrompt = this.promptService.render('book/chat', {
      nativeLanguage,
      targetLanguage,
      bookTitle: book.title,
      chapterTitle,
      chapterContent,
      userMessage: message,
    })

    const aiConfig = await this.configService.getAiConfig()

    await this.aiService.streamChat(
      aiConfig,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        maxTokens: 1000,
      },
      {
        onChunk: handlers.onChunk,
        onComplete: async (data) => {
          const content = data.content.trim()

          if (!content) {
            const error = new Error('AI did not return a response. Please try again.')
            logger.warn({ userId, bookId }, 'AI stream completed with empty response')
            handlers.onError(error)
            return
          }

          try {
            await BookChat.create({
              userId,
              bookId,
              role: 'user',
              content: message,
            })
            await BookChat.create({
              userId,
              bookId,
              role: 'assistant',
              content: data.content,
            })
            logger.info({ userId, bookId }, 'Chat messages saved')
          } catch (error) {
            logger.error({ err: error }, 'Failed to save chat messages')
          }
          handlers.onComplete(data)
        },
        onError: handlers.onError,
      }
    )
  }
}
