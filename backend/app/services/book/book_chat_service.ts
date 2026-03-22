import { inject } from '@adonisjs/core'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import { UserConfigService } from '#services/user/user_config_service'
import PromptService from '#services/ai/prompt_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import BookChat from '#models/book_chat'
import logger from '@adonisjs/core/services/logger'
import { BookService } from '#services/book/book_service'

export type BookChatActionType = 'explain' | 'qa' | 'translate'

export interface ChatParams {
  userId: number
  bookId: number
  isAdmin: boolean
  message: string
  actionType?: BookChatActionType
  chapterIndex?: number | undefined
}

export interface StreamHandlers {
  onChunk: (data: { delta: string; isComplete: boolean }) => void
  onComplete: (data: {
    content: string
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  }) => void
  onError: (error: Error) => void
  /** Optional guard to check if the client has disconnected */
  isAborted?: () => boolean
}

export interface SimpleChatParams {
  userId: number
  bookId: number
  message: string
  actionType?: BookChatActionType
  bookTitle?: string
  chapterContent?: string
}

const LANGUAGE_LABEL_MAP: Record<string, string> = {
  zh: 'Chinese',
  'zh-CN': 'Chinese',
  'zh-TW': 'Traditional Chinese',
  en: 'English',
  'en-US': 'American English',
  'en-GB': 'British English',
  ja: 'Japanese',
  ko: 'Korean',
}

@inject()
export class BookChatService {
  constructor(
    private aiService: AiService,
    private configService: ConfigService,
    private userConfigService: UserConfigService,
    private promptService: PromptService,
    private bookService: BookService
  ) {}

  async chat(params: SimpleChatParams): Promise<string> {
    const { userId, bookId, message, actionType, bookTitle, chapterContent } = params

    const [userConfig, book] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      Book.findOrFail(bookId),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'
    const nativeLanguageLabel = this.getLanguageLabel(nativeLanguage)
    const targetLanguageLabel = this.getLanguageLabel(targetLanguage)

    const systemPrompt = this.renderSystemPrompt({
      actionType,
      nativeLanguage,
      nativeLanguageLabel,
      targetLanguage,
      targetLanguageLabel,
      bookTitle: bookTitle || book.title,
      chapterTitle: undefined,
      chapterContent: chapterContent || undefined,
      userMessage: message,
      selectedText: message,
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

  async streamChat(
    params: ChatParams,
    handlers: StreamHandlers,
    signal?: AbortSignal
  ): Promise<void> {
    const { userId, bookId, isAdmin, message, actionType, chapterIndex } = params

    const [userConfig, book] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      this.bookService.findReadableBookById(bookId, { isAdmin }),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'
    const nativeLanguageLabel = this.getLanguageLabel(nativeLanguage)
    const targetLanguageLabel = this.getLanguageLabel(targetLanguage)

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

    const systemPrompt = this.renderSystemPrompt({
      actionType,
      nativeLanguage,
      nativeLanguageLabel,
      targetLanguage,
      targetLanguageLabel,
      bookTitle: book.title,
      chapterTitle,
      chapterContent,
      userMessage: message,
      selectedText: message,
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
        signal,
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

  private getLanguageLabel(languageCode: string): string {
    return LANGUAGE_LABEL_MAP[languageCode] ?? languageCode
  }

  private renderSystemPrompt(params: {
    actionType?: BookChatActionType
    nativeLanguage: string
    nativeLanguageLabel: string
    targetLanguage: string
    targetLanguageLabel: string
    bookTitle: string
    chapterTitle?: string
    chapterContent?: string
    userMessage: string
    selectedText: string
  }): string {
    if (params.actionType) {
      return this.promptService.render('book/selection-chat', params)
    }

    return this.promptService.render('book/chat', params)
  }
}
