import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai_service'
import PromptService from '#services/prompt_service'
import { ConfigService } from '#services/config_service'
import { TagService } from '#services/tag_service'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'
import Tag from '#models/tag'
import ArticleVocabulary from '#models/article_vocabulary'
import { ARTICLE_CONTENT, ARTICLE_DIFFICULTY } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type {
  ArticleStrategy,
  ArticleOutline,
  ChapterContent,
  VocabularyAndTags,
  GenerateArticleParams,
} from '#types/article_generation'

type TransactionClient = Awaited<ReturnType<typeof db.transaction>>

@inject()
export class ArticleGenerationService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private tagService: TagService
  ) {}

  async generateArticle(userId: number, params: GenerateArticleParams): Promise<Article> {
    const config = this.getDifficultyConfig(params.difficultyLevel)
    const aiConfig = await this.configService.getAiConfig()
    const languageConfig = await this.configService.getUserLanguageConfig(userId)

    const strategy = await this.executeStep0(params, config, aiConfig)

    const outline = await this.executeStep1(strategy, aiConfig)

    const chapters = await this.executeStep2(outline, config, aiConfig)

    const { vocabulary, tags } = await this.executeStep3(chapters, languageConfig, aiConfig)

    return await this.saveArticle(userId, params, {
      title: outline.title,
      chapters,
      vocabulary,
      tags,
    })
  }

  private async executeStep0(
    params: GenerateArticleParams,
    config: DifficultyConfig,
    aiConfig: AiClientConfig
  ): Promise<ArticleStrategy> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('article/00-strategy', {
      topic: params.topic,
      level: params.difficultyLevel,
      levelDescription: config.description,
      extraInstructions: params.extraInstructions || '',
    })

    logger.info({ step: 0, topic: params.topic }, 'Step 0: Strategy analysis')

    const response = await this.aiService.chatJson<ArticleStrategy>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1000,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 0, strategy: response }, 'Step 0 completed')

    return response
  }

  private async executeStep1(
    strategy: ArticleStrategy,
    aiConfig: AiClientConfig
  ): Promise<ArticleOutline> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('article/01-outline', {
      strategy: JSON.stringify(strategy),
    })

    logger.info({ step: 1, strategy: strategy.contentType }, 'Step 1: Outline generation')

    const response = await this.aiService.chatJson<ArticleOutline>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 1, outline: response }, 'Step 1 completed')

    return response
  }

  private async executeStep2(
    outline: ArticleOutline,
    config: DifficultyConfig,
    aiConfig: AiClientConfig
  ): Promise<ChapterContent[]> {
    const systemPrompt = this.promptService.render('system', {})
    const chapters: ChapterContent[] = []

    for (const chapter of outline.chapters) {
      const prompt = this.promptService.render('article/02-content', {
        outline: JSON.stringify(outline),
        chapterIndex: chapter.index,
      })

      logger.info({ step: 2, chapter: chapter.index }, 'Step 2: Content generation')

      const response = await this.aiService.chatJson<ChapterContent>(aiConfig, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        maxTokens: config.maxTokens,
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
      })

      chapters.push(response)
      logger.info(
        { step: 2, chapter: chapter.index, wordCount: response.wordCount },
        'Step 2 chapter completed'
      )
    }

    return chapters
  }

  private async executeStep3(
    chapters: ChapterContent[],
    _languageConfig: { nativeLanguage: string },
    aiConfig: AiClientConfig
  ): Promise<VocabularyAndTags> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('article/03-vocabulary', {
      chapters: JSON.stringify(chapters),
    })

    logger.info({ step: 3, chapterCount: chapters.length }, 'Step 3: Vocabulary extraction')

    const response = await this.aiService.chatJson<VocabularyAndTags>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info(
      { step: 3, vocabulary: response.vocabulary.length, tags: response.tags.length },
      'Step 3 completed'
    )

    return response
  }

  private async saveArticle(
    userId: number,
    params: GenerateArticleParams,
    data: {
      title: string
      chapters: ChapterContent[]
      vocabulary: VocabularyAndTags['vocabulary']
      tags: VocabularyAndTags['tags']
    }
  ): Promise<Article> {
    const wordCount = data.chapters.reduce((sum, c) => sum + c.wordCount, 0)

    return await db.transaction(async (trx) => {
      const article = await Article.create(
        {
          title: data.title,
          difficultyLevel: params.difficultyLevel,
          wordCount,
          readingTime: Math.ceil(wordCount / ARTICLE_CONTENT.READING_SPEED),
          isPublished: true,
          createdBy: userId,
        },
        { client: trx as any }
      )

      logger.debug('[Article Generation] Article created', { id: article.id, title: article.title })

      const chaptersData = data.chapters.map((chapter) => ({
        articleId: article.id,
        chapterIndex: chapter.index,
        title: chapter.title,
        content: chapter.content,
      }))
      await ArticleChapter.createMany(chaptersData, { client: trx as any })
      logger.info(`Saved ${chaptersData.length} chapters for article ${article.id}`)

      const tags = await this.processTags(data.tags, trx)
      await article.related('tags').attach(
        tags.map((t) => t.id),
        trx as any
      )

      if (data.vocabulary && data.vocabulary.length > 0) {
        const vocabularyData = data.vocabulary.map((item) => ({
          articleId: article.id,
          word: item.word,
          meaning: item.meaning,
          sentence: item.sentence,
          phonetic: item.phonetic || null,
        }))
        await ArticleVocabulary.createMany(vocabularyData, { client: trx as any })
        logger.info(`Saved ${vocabularyData.length} vocabulary items for article ${article.id}`)
      }

      await article.load('tags')

      logger.info(`Article generated successfully: ${article.id}, tags: ${tags.length}`)

      return article
    })
  }

  private async processTags(
    aiTags: Array<{ name: string; isNew: boolean }>,
    trx: TransactionClient
  ): Promise<Tag[]> {
    const tags: Tag[] = []
    for (const aiTag of aiTags) {
      const tag = await this.tagService.findOrCreateByName(aiTag.name, trx as any)
      tags.push(tag)
    }
    return tags
  }

  private getDifficultyConfig(level: string): DifficultyConfig {
    return {
      maxWords:
        ARTICLE_CONTENT[`MAX_WORDS_${level}` as keyof typeof ARTICLE_CONTENT] ||
        ARTICLE_CONTENT.MAX_WORDS,
      maxTokens:
        ARTICLE_CONTENT[`MAX_TOKENS_${level}` as keyof typeof ARTICLE_CONTENT] ||
        ARTICLE_CONTENT.MAX_TOKENS,
      description: this.getLevelDescription(level),
    }
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
}

interface DifficultyConfig {
  maxWords: number
  maxTokens: number
  description: string
}
