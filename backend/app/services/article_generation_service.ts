import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai_service'
import PromptService from '#services/prompt_service'
import { ConfigService } from '#services/config_service'
import { TagService } from '#services/tag_service'
import { ArticleResponseParser } from '#services/article_response_parser'
import Article from '#models/article'
import ArticleChapter from '#models/article_chapter'
import Tag from '#models/tag'
import ArticleVocabulary from '#models/article_vocabulary'
import { ARTICLE_CONTENT, ARTICLE_DIFFICULTY } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type { GenerateArticleParams, ParsedArticleResponse, DifficultyConfig } from '#types/article'

type TransactionClient = Awaited<ReturnType<typeof db.transaction>>

@inject()
export class ArticleGenerationService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private tagService: TagService,
    private articleResponseParser: ArticleResponseParser
  ) {}

  async generateArticle(userId: number, params: GenerateArticleParams): Promise<Article> {
    const config = this.getDifficultyConfig(params.difficultyLevel)
    const aiConfig = await this.configService.getAiConfig()
    const languageConfig = await this.configService.getUserLanguageConfig(userId)

    const existingTags = await Tag.query().select('id', 'name', 'slug')
    logger.info(`Found ${existingTags.length} existing tags in system`)

    const prompt = this.promptService.render('article_generation', {
      level: params.difficultyLevel,
      levelDescription: config.description,
      topic: params.topic,
      maxWords: config.maxWords,
      existingTags: existingTags.map((t) => t.name).join(', ') || 'No existing tags',
      extraInstructions: params.extraInstructions || '',
      nativeLanguage: languageConfig.nativeLanguage,
      targetLanguage: languageConfig.targetLanguage,
      englishVariant: languageConfig.englishVariant,
    })

    const parsedData = await this.callAi(aiConfig, prompt, config.maxTokens)

    if (!parsedData.chapters || parsedData.chapters.length === 0) {
      throw new Error('AI response is missing chapters field or chapters array is empty')
    }

    const totalContent = parsedData.chapters.map((c) => c.content).join(' ')
    let wordCount = parsedData.wordCount
    if (wordCount === 0) {
      wordCount = this.countWords(totalContent)
    }

    if (totalContent.length > ARTICLE_CONTENT.MAX_CHARS) {
      logger.warn('Article content exceeds limit, truncating...')
    }

    return await db.transaction(async (trx) => {
      const article = await Article.create(
        {
          title: parsedData.title,
          difficultyLevel: params.difficultyLevel,
          wordCount: wordCount,
          readingTime: Math.ceil(wordCount / ARTICLE_CONTENT.READING_SPEED),
          isPublished: true,
          createdBy: userId,
        },
        { client: trx as any }
      )

      logger.debug('[Article Generation] Article created', {
        id: article.id,
        title: article.title,
      })

      const chaptersData = parsedData.chapters.map((chapter, index) => ({
        articleId: article.id,
        chapterIndex: typeof chapter.index === 'number' ? chapter.index : index,
        title: chapter.title,
        content: chapter.content,
      }))
      await ArticleChapter.createMany(chaptersData, { client: trx as any })
      logger.info(`Saved ${chaptersData.length} chapters for article ${article.id}`)

      const tags = await this.processTags(parsedData.tags, trx)
      await article.related('tags').attach(
        tags.map((t) => t.id),
        trx as any
      )

      if (parsedData.vocabulary && parsedData.vocabulary.length > 0) {
        const vocabularyData = parsedData.vocabulary.map((item) => ({
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

  private async callAi(
    config: AiClientConfig,
    prompt: string,
    maxTokens: number
  ): Promise<ParsedArticleResponse> {
    logger.info('[Article Generation] Starting AI request', {
      model: config.model,
      maxTokens,
    })

    const systemPrompt = this.promptService.render('system', {})

    const rawJson = await this.aiService.chatJson<RawAiResponse>(config, {
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

    return this.articleResponseParser.parse(rawJson as any)
  }

  private getDifficultyConfig(level: string): DifficultyConfig {
    return {
      maxWords: ARTICLE_CONTENT.MAX_WORDS,
      maxTokens: ARTICLE_CONTENT.MAX_TOKENS,
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

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length
  }
}

interface RawAiResponse {
  title: string
  chapters: unknown
  wordCount: number
  tags: unknown
  vocabulary: unknown
}
