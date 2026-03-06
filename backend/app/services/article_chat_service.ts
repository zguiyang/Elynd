import { inject } from '@adonisjs/core'
import { AiService } from '#services/ai_service'
import { ConfigService } from '#services/config_service'
import { UserConfigService } from '#services/user_config_service'
import PromptService from '#services/prompt_service'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'
import ArticleChat from '#models/article_chat'
import logger from '@adonisjs/core/services/logger'

export interface ChatParams {
  userId: number
  articleId: number
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
  articleId: number
  message: string
  articleTitle?: string
  chapterContent?: string
}

@inject()
export class ArticleChatService {
  constructor(
    private aiService: AiService,
    private configService: ConfigService,
    private userConfigService: UserConfigService,
    private promptService: PromptService
  ) {}

  async chat(params: SimpleChatParams): Promise<string> {
    const { userId, articleId, message, articleTitle, chapterContent } = params

    const [userConfig, article] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      Article.findOrFail(articleId),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'

    const systemPrompt = this.promptService.render('article/chat', {
      nativeLanguage,
      targetLanguage,
      articleTitle: articleTitle || article.title,
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
    const { userId, articleId, message, chapterIndex } = params

    const [userConfig, article] = await Promise.all([
      this.userConfigService.getConfigByUserId(userId),
      Article.findOrFail(articleId),
    ])

    const nativeLanguage = userConfig?.nativeLanguage ?? 'zh'
    const targetLanguage = userConfig?.targetLanguage ?? 'en'

    let chapterTitle: string | undefined
    let chapterContent: string | undefined

    if (chapterIndex !== undefined) {
      const chapter = await ArticleChapter.query()
        .where('article_id', articleId)
        .where('chapter_index', chapterIndex)
        .first()

      if (chapter) {
        chapterTitle = chapter.title
        chapterContent = chapter.content
      }
    }

    const systemPrompt = this.promptService.render('article/chat', {
      nativeLanguage,
      targetLanguage,
      articleTitle: article.title,
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
          try {
            await ArticleChat.create({
              userId,
              articleId,
              role: 'user',
              content: message,
            })
            await ArticleChat.create({
              userId,
              articleId,
              role: 'assistant',
              content: data.content,
            })
            logger.info({ userId, articleId }, 'Chat messages saved')
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
