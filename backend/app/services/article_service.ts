import { inject } from '@adonisjs/core'
import { AiService } from '#services/ai_service'
import PromptService from '#services/prompt_service'
import { TagService } from '#services/tag_service'
import Article from '#models/article'
import Tag from '#models/tag'
import SystemConfig from '#models/system_config'
import UserConfig from '#models/user_config'
import ArticleVocabulary from '#models/article_vocabulary'
import logger from '@adonisjs/core/services/logger'
import { ARTICLE_CONTENT, ARTICLE_DIFFICULTY } from '#constants'
import {
  ArticleGenerationFailedException,
  ArticleNotFoundException,
} from '#exceptions/article_exceptions'

interface GenerateArticleParams {
  difficultyLevel: string
  topic: string
  extraInstructions?: string
}

interface VocabularyItem {
  word: string
  meaning: string
  sentence: string
  phonetic?: string
}

interface AiArticleResponse {
  title: string
  content: string
  wordCount: number
  tags: Array<{ name: string; isNew: boolean }>
  vocabulary: VocabularyItem[]
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
    const userConfig = await this.getUserAiConfig()
    const languageConfig = await this.getLanguageConfig(userId)

    const existingTags = await Tag.query().select('id', 'name', 'slug')
    const existingTagsText = existingTags.map((t) => t.name).join(', ')

    logger.info(`Found ${existingTags.length} existing tags in system`)

    const prompt = this.promptService.render('article_generation', {
      level: params.difficultyLevel,
      levelDescription: config.description,
      topic: params.topic,
      maxWords: config.maxWords,
      existingTags: existingTagsText || 'No existing tags',
      extraInstructions: params.extraInstructions || '',
      nativeLanguage: languageConfig.nativeLanguage,
      targetLanguage: languageConfig.targetLanguage,
      englishVariant: languageConfig.englishVariant,
    })

    const articleData = await this.callAiWithRetry(userConfig, prompt, config.maxTokens)

    if (!articleData.content) {
      logger.error({ articleData }, 'AI response missing content field')
      throw new ArticleGenerationFailedException('AI response is missing content field')
    }

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

    if (articleData.vocabulary && articleData.vocabulary.length > 0) {
      const vocabularyData = articleData.vocabulary.map((item) => ({
        articleId: article.id,
        word: item.word,
        meaning: item.meaning,
        sentence: item.sentence,
        phonetic: item.phonetic || null,
      }))
      await ArticleVocabulary.createMany(vocabularyData)
      logger.info(`Saved ${vocabularyData.length} vocabulary items for article ${article.id}`)
    }

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
        logger.info('[Article Generation] Starting AI request', {
          model: userConfig.modelName || 'gpt-4o-mini',
          maxTokens,
          attempt: i + 1,
        })

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

        logger.info('[Article Generation] AI response received', {
          success: response.success,
          hasData: 'data' in response,
          hasChoices: !!(response as any).choices,
          responseType:
            typeof (response as any).data ||
            typeof (response as any).choices?.[0]?.message?.content,
        })

        let articleData: string
        if (response.success && 'data' in response) {
          const openaiResponse = (response as any).data
          articleData = openaiResponse.choices?.[0]?.message?.content || ''
        } else {
          articleData = (response as any).choices?.[0]?.message?.content || ''
        }

        if (!articleData) {
          logger.error({ response }, 'No content in AI response')
          throw new ArticleGenerationFailedException('AI response has no content')
        }

        const rawContent =
          articleData.length > 500 ? articleData.substring(0, 500) + '...(truncated)' : articleData
        logger.debug('[Article Generation] Raw response content', {
          content: rawContent,
        })

        logger.debug('[Article Generation] Extracted article data', {
          dataLength: articleData.length,
          dataPreview: articleData.substring(0, 200),
        })

        const parsedArticleData = JSON.parse(articleData) as AiArticleResponse

        logger.info('[Article Generation] JSON parsed successfully', {
          hasTitle: !!parsedArticleData.title,
          hasContent: !!parsedArticleData.content,
          contentLength: parsedArticleData.content?.length || 0,
          hasWordCount: !!parsedArticleData.wordCount,
          tagsCount: parsedArticleData.tags?.length || 0,
          vocabularyCount: parsedArticleData.vocabulary?.length || 0,
        })

        if (!parsedArticleData.content) {
          logger.error({ parsedArticleData }, 'AI response missing content field')
          throw new ArticleGenerationFailedException('AI response missing content field')
        }

        logger.info('AI generation successful', {
          title: parsedArticleData.title,
          wordCount: parsedArticleData.wordCount,
          tagCount: parsedArticleData.tags?.length || 0,
          vocabularyCount: parsedArticleData.vocabulary?.length || 0,
        })

        return parsedArticleData
      } catch (error) {
        lastError = error as Error

        if (error instanceof SyntaxError) {
          logger.error('[Article Generation] JSON parse failed', {
            errorType: 'JSON_PARSE_ERROR',
            errorMessage: error.message,
            attempt: i + 1,
          })
        } else if (error instanceof TypeError) {
          logger.error('[Article Generation] Data validation failed', {
            errorType: 'VALIDATION_ERROR',
            errorMessage: error.message,
            attempt: i + 1,
          })
        } else {
          logger.error('[Article Generation] Unknown error occurred', {
            errorType: 'UNKNOWN_ERROR',
            errorMessage: error.message,
            attempt: i + 1,
          })
        }

        if (i < maxRetries - 1) {
          logger.info('[Article Generation] Retrying in 1 second...', { nextAttempt: i + 2 })
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

  async getVocabularyByArticleId(articleId: number) {
    const vocabularies = await ArticleVocabulary.query()
      .where('articleId', articleId)
      .orderBy('id', 'asc')

    return vocabularies
  }

  private async getLanguageConfig(userId: number) {
    const userConfig = await UserConfig.query().where('userId', userId).first()

    return {
      nativeLanguage: userConfig?.nativeLanguage || 'zh',
      targetLanguage: userConfig?.targetLanguage || 'en',
      englishVariant: userConfig?.englishVariant || 'en-US',
    }
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

  private async getUserAiConfig() {
    const config = await SystemConfig.first()

    const apiKey = config?.aiApiKey || process.env.OPENAI_API_KEY
    const baseUrl = config?.aiBaseUrl || process.env.OPENAI_BASE_URL
    const modelName = config?.aiModelName || process.env.OPENAI_MODEL_NAME || 'gpt-4o-mini'

    return {
      enabled: true,
      apiKey,
      baseUrl,
      modelName,
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
