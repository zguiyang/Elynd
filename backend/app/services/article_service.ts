import { inject } from '@adonisjs/core'
import { AiService } from '#services/ai_service'
import PromptService from '#services/prompt_service'
import { TagService } from '#services/tag_service'
import Article from '#models/article'
import Tag from '#models/tag'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'
import { ARTICLE_CONTENT, ARTICLE_DIFFICULTY } from '#constants'
import {
  ArticleGenerationFailedException,
  ArticleNotFoundException,
} from '#exceptions/article_exceptions'

interface GenerateArticleParams {
  difficultyLevel: string
  topic: string
}

interface AiArticleResponse {
  title: string
  content: string
  wordCount: number
  tags: Array<{ name: string; isNew: boolean }>
}

interface ListPublishedParams {
  difficulty?: string
  tagId?: number
  page?: number
  perPage?: number
}

@inject()
export class ArticleService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private tagService: TagService
  ) {}

  async generateArticle(userId: number, params: GenerateArticleParams): Promise<Article> {
    const config = this.getDifficultyConfig(params.difficultyLevel)
    const user = await User.findOrFail(userId)
    const userConfig = await this.getUserAiConfig(user)

    const existingTags = await Tag.query().select('id', 'name', 'slug')
    const existingTagsText = existingTags.map((t) => t.name).join(', ')

    logger.info(`Found ${existingTags.length} existing tags in system`)

    const prompt = this.promptService.render('article_generation', {
      level: params.difficultyLevel,
      levelDescription: config.description,
      topic: params.topic,
      maxWords: config.maxWords,
      existingTags: existingTagsText || 'No existing tags',
    })

    const articleData = await this.callAiWithRetry(userConfig, prompt, config.maxTokens)

    if (articleData.content.length > ARTICLE_CONTENT.MAX_CHARS) {
      logger.warn('Article content exceeds limit, truncating...')
      articleData.content = articleData.content.substring(0, ARTICLE_CONTENT.MAX_CHARS)
      articleData.wordCount = this.countWords(articleData.content)
    }

    const article = await Article.create({
      title: articleData.title,
      content: articleData.content,
      difficultyLevel: params.difficultyLevel,
      wordCount: articleData.wordCount,
      readingTime: Math.ceil(articleData.wordCount / ARTICLE_CONTENT.READING_SPEED),
      isPublished: true,
      createdBy: userId,
    })

    const tags = await this.processTags(articleData.tags, existingTags)

    await article.related('tags').attach(tags.map((t) => t.id))

    await article.load('tags')

    logger.info(`Article generated successfully: ${article.id}, tags: ${tags.length}`)

    return article
  }

  private async processTags(
    aiTags: Array<{ name: string; isNew: boolean }>,
    existingTags: Tag[]
  ): Promise<Tag[]> {
    const tags: Tag[] = []

    for (const aiTag of aiTags) {
      let tag: Tag | null = null

      if (aiTag.isNew) {
        const slug = this.tagService.generateSlug(aiTag.name)
        tag = await Tag.findBy('slug', slug)

        if (!tag) {
          tag = await Tag.create({
            name: aiTag.name,
            slug: slug,
          })
          logger.info(`Created new tag: ${aiTag.name}`)
        } else {
          logger.info(`Tag already exists (AI thought it was new): ${aiTag.name}`)
        }
      } else {
        const slug = this.tagService.generateSlug(aiTag.name)
        tag = existingTags.find((t) => t.slug === slug) || (await Tag.findBy('slug', slug))

        if (!tag) {
          tag = await Tag.create({
            name: aiTag.name,
            slug: slug,
          })
          logger.warn(`Tag marked as existing but not found, created: ${aiTag.name}`)
        }
      }

      if (tag) {
        tags.push(tag)
      }
    }

    return tags
  }

  private async callAiWithRetry(
    userConfig: any,
    prompt: string,
    maxTokens: number
  ): Promise<AiArticleResponse> {
    const maxRetries = 2
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.aiService.chat(userConfig, {
          model: userConfig.modelName || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a JSON-only response generator.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        })

        const articleData = (response.success && 'data' in response
          ? response.data
          : (response as any).choices?.[0]?.message?.content
          ) as string

        const parsedArticleData = JSON.parse(articleData) as AiArticleResponse

        logger.info('AI generation successful', {
          title: parsedArticleData.title,
          wordCount: parsedArticleData.wordCount,
          tagCount: parsedArticleData.tags?.length || 0,
        })

        return parsedArticleData
      } catch (error) {
        lastError = error as Error
        logger.warn(`Article generation attempt ${i + 1} failed`, { error })
        if (i < maxRetries - 1) {
          await this.sleep(1000)
        }
      }
    }

    throw new ArticleGenerationFailedException(
      `Failed after ${maxRetries} attempts: ${lastError?.message}`
    )
  }

  async listPublished(params: ListPublishedParams) {
    const query = Article.query().where('isPublished', true).preload('tags')

    if (params.difficulty) {
      query.where('difficultyLevel', params.difficulty)
    }

    if (params.tagId) {
      const tagId = params.tagId
      query.whereHas('tags', (tagQuery) => {
        tagQuery.where('id', tagId)
      })
    }

    return query.orderBy('createdAt', 'desc').paginate(params.page || 1, params.perPage || 20)
  }

  async findPublishedById(id: number) {
    const article = await Article.query()
      .where('id', id)
      .where('isPublished', true)
      .preload('tags')
      .first()

    if (!article) {
      throw new ArticleNotFoundException()
    }

    return article
  }

  async findById(id: number) {
    const article = await Article.query().where('id', id).preload('tags').first()

    if (!article) {
      throw new ArticleNotFoundException()
    }

    return article
  }

  private getDifficultyConfig(level: string) {
    const configs: Record<string, { maxWords: number; maxTokens: number; description: string }> = {
      [ARTICLE_DIFFICULTY.L1]: {
        maxWords: ARTICLE_CONTENT.MAX_WORDS_L1,
        maxTokens: ARTICLE_CONTENT.MAX_TOKENS_L1,
        description: 'Beginner - Simple sentences, basic vocabulary (500-800 words)',
      },
      [ARTICLE_DIFFICULTY.L2]: {
        maxWords: ARTICLE_CONTENT.MAX_WORDS_L2,
        maxTokens: ARTICLE_CONTENT.MAX_TOKENS_L2,
        description: 'Intermediate - Moderate complexity (800-1500 words)',
      },
      [ARTICLE_DIFFICULTY.L3]: {
        maxWords: ARTICLE_CONTENT.MAX_WORDS_L3,
        maxTokens: ARTICLE_CONTENT.MAX_TOKENS_L3,
        description: 'Advanced - Complex structures (1500-2500 words)',
      },
    }
    return configs[level] || configs[ARTICLE_DIFFICULTY.L2]
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }

  private async getUserAiConfig(user: User) {
    await user.load('config')
    const config = user.config

    return {
      enabled: true,
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      modelName: config?.aiModelName || 'gpt-4o-mini',
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
