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
import type { AiClientConfig } from '#types/ai'
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
  tableOfContents: string[] | null
  chapterCount: number
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

  // Normalize TOC into string[] or null
  private normalizeToc(input: unknown): string[] | null {
    if (input === null || input === undefined) return null
    // Already array
    if (Array.isArray(input)) {
      const arr = input.map((v) => String(v).trim()).filter((s) => s.length > 0)
      return arr.length ? arr : []
    }

    // Object -> take values
    if (typeof input === 'object') {
      try {
        const values = Object.values(input as Record<string, unknown>)
        const arr = values.map((v) => String(v).trim()).filter((s) => s.length > 0)
        return arr.length ? arr : []
      } catch {
        return null
      }
    }

    // String -> try to parse and repair common patterns
    if (typeof input === 'string') {
      const raw = input.trim()
      if (!raw) return null
      // If it's a JSON array string
      if (raw.startsWith('[')) {
        try {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) {
            const fixed = arr.map((v) => String(v).trim()).filter((s) => s.length > 0)
            return fixed.length ? fixed : []
          }
        } catch {}
      }
      // Common AI mistake: {"a", "b"} should be ["a", "b"]
      if (raw.startsWith('{') && raw.includes('"')) {
        const fixedCandidate = raw
          .replace(/\s+/g, ' ')
          .replace(/^\{\s*((?:"[^"]*"\s*,\s*)*"[^"]*")\s*\}$/g, '[$1]')
        try {
          const arr = JSON.parse(fixedCandidate)
          if (Array.isArray(arr)) {
            const fixed = arr.map((v) => String(v).trim()).filter((s) => s.length > 0)
            return fixed.length ? fixed : []
          }
        } catch {}
      }
      // Fallback: split by common delimiters
      const list = raw
        .split(/[\n,，、;；]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return list.length ? list : []
    }

    return null
  }

  async generateArticle(userId: number, params: GenerateArticleParams): Promise<Article> {
    const config = this.getDifficultyConfig(params.difficultyLevel)
    const aiConfig = await this.getAiConfig()
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

    const articleData = await this.callAi(aiConfig, prompt, config.maxTokens)

    if (!articleData.content) {
      logger.error({ articleData }, 'AI response missing content field')
      throw new ArticleGenerationFailedException('AI response is missing content field')
    }

    if (articleData.content.length > ARTICLE_CONTENT.MAX_CHARS) {
      logger.warn('Article content exceeds limit, truncating...')
      articleData.content = articleData.content.substring(0, ARTICLE_CONTENT.MAX_CHARS)
      articleData.wordCount = this.countWords(articleData.content)
    }

    // Final guard/normalization for TOC before persisting
    const normalizedToc = this.normalizeToc(articleData.tableOfContents as unknown)

    if (!Array.isArray(normalizedToc)) {
      logger.warn('[Article Generation] Invalid TOC before insert, coercing to []', {
        tocType: typeof (articleData as any).tableOfContents,
        tocPreview: String((articleData as any).tableOfContents ?? '').slice(0, 200),
      })
    }

    const article = await Article.create({
      title: articleData.title,
      content: articleData.content,
      difficultyLevel: params.difficultyLevel,
      wordCount: articleData.wordCount,
      readingTime: Math.ceil(articleData.wordCount / ARTICLE_CONTENT.READING_SPEED),
      // IMPORTANT: always pass JS array (or empty array) to JSON column
      tableOfContents: Array.isArray(normalizedToc) ? normalizedToc : [],
      chapterCount: articleData.chapterCount || null,
      isPublished: true,
      createdBy: userId,
    })

    logger.debug('[Article Generation] Article created', {
      id: article.id,
      title: article.title,
      tableOfContentsType: typeof articleData.tableOfContents,
      tableOfContentsIsArray: Array.isArray(articleData.tableOfContents),
      tableOfContentsValue: JSON.stringify(articleData.tableOfContents)?.substring(0, 500),
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

  private async callAi(
    config: AiClientConfig,
    prompt: string,
    maxTokens: number
  ): Promise<AiArticleResponse> {
    logger.info('[Article Generation] Starting AI request', {
      model: config.model,
      maxTokens,
    })

    const systemPrompt = this.promptService.render('system', {})

    const rawJson = await this.aiService.chatJson<AiArticleResponse>(config, {
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ],
      maxTokens,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info('[Article Generation] AI response received')

    return this.parseArticleResponse(rawJson)
  }

  private parseArticleResponse(raw: AiArticleResponse): AiArticleResponse {
    let processedData = JSON.stringify(raw)

    processedData = processedData.replace(
      /"tableOfContents"\s*:\s*\{((?:\s*"[^"]*"\s*,?)*)\}/gs,
      '"tableOfContents": [$1]'
    )
    processedData = processedData.replace(
      /"table_of_contents"\s*:\s*\{((?:\s*"[^"]*"\s*,?)*)\}/gs,
      '"table_of_contents": [$1]'
    )

    let parsedArticleData: AiArticleResponse
    try {
      parsedArticleData = JSON.parse(processedData) as AiArticleResponse
    } catch (parseError) {
      logger.error(
        {
          parseError: (parseError as Error).message,
          rawResponse: JSON.stringify(raw).substring(0, 1000),
        },
        '[Article Generation] JSON parse failed'
      )
      throw new ArticleGenerationFailedException('AI response is not valid JSON')
    }

    if (parsedArticleData.tableOfContents) {
      if (!Array.isArray(parsedArticleData.tableOfContents)) {
        parsedArticleData.tableOfContents = this.normalizeToc(parsedArticleData.tableOfContents)
      }
    }

    if (!Array.isArray(parsedArticleData.tableOfContents)) {
      parsedArticleData.tableOfContents = []
    }

    if (parsedArticleData.tags) {
      if (!Array.isArray(parsedArticleData.tags)) {
        parsedArticleData.tags = []
      } else {
        parsedArticleData.tags = parsedArticleData.tags.filter(
          (t) => t && typeof t === 'object' && typeof t.name === 'string'
        )
      }
    } else {
      parsedArticleData.tags = []
    }

    if (parsedArticleData.vocabulary) {
      if (!Array.isArray(parsedArticleData.vocabulary)) {
        parsedArticleData.vocabulary = []
      } else {
        parsedArticleData.vocabulary = parsedArticleData.vocabulary.filter(
          (v) => v && typeof v === 'object' && typeof v.word === 'string'
        )
      }
    } else {
      parsedArticleData.vocabulary = []
    }

    if (!parsedArticleData.content) {
      throw new ArticleGenerationFailedException('AI response missing content field')
    }

    logger.info('[Article Generation] JSON parsed successfully', {
      title: parsedArticleData.title,
      tagsCount: parsedArticleData.tags?.length || 0,
      vocabularyCount: parsedArticleData.vocabulary?.length || 0,
    })

    return parsedArticleData
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
    const unifiedConfig = {
      maxWords: ARTICLE_CONTENT.MAX_WORDS,
      maxTokens: ARTICLE_CONTENT.MAX_TOKENS,
      description: this.getLevelDescription(level),
    }
    return unifiedConfig
  }

  private getLevelDescription(level: string): string {
    const descriptions: Record<string, string> = {
      [ARTICLE_DIFFICULTY.L1]:
        'L1 - Beginner (Grade 1 / Primary 1): Approximately 500 basic everyday words, simple sentences, short phrases, basic grammar',
      [ARTICLE_DIFFICULTY.L2]:
        'L2 - Intermediate (Grade 2-3 / Primary 2-3): Approximately 1000 common words, compound sentences, moderate length, past/future tense',
      [ARTICLE_DIFFICULTY.L3]:
        'L3 - Advanced (Grade 4-5 / Primary 4-5): Approximately 2000 words with diverse expressions, complex sentences, various tenses',
    }
    return descriptions[level] || descriptions[ARTICLE_DIFFICULTY.L2]
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }

  private async getAiConfig(): Promise<AiClientConfig> {
    const config = await SystemConfig.first()

    return {
      baseUrl: config?.aiBaseUrl || '',
      apiKey: config?.aiApiKey || '',
      model: config?.aiModelName || '',
    }
  }
}
