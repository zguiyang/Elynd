import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai/ai_service'
import PromptService from '#services/ai/prompt_service'
import { ConfigService } from '#services/ai/config_service'
import { TagService } from '#services/book/tag_service'
import Book from '#models/book'
import BookChapter from '#models/book_chapter'
import Tag from '#models/tag'
import BookVocabulary from '#models/book_vocabulary'
import { ARTICLE_CONTENT, ARTICLE_DIFFICULTY } from '#constants'
import type { AiClientConfig } from '#types/ai'
import type {
  FullUserConfig,
  LearnerProfile,
  BookStrategy,
  AiPlanning,
  CharactersAndScenes,
  BookOutline,
  AllChapterStructures,
  ChapterStructure,
  ChapterContent,
  Vocabulary,
  BookTags,
  GenerateBookParams,
} from '#types/book_generation'

@inject()
export class BookGenerationService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private tagService: TagService
  ) {}

  async generateBook(userId: number, params: GenerateBookParams): Promise<Book> {
    const userConfig = await this.configService.getFullUserConfig(userId)
    const difficultyConfig = this.getDifficultyConfig(params.difficultyLevel)
    const aiConfig = await this.configService.getAiConfig()

    logger.info({ userId, topic: params.topic }, 'Starting book generation with 9-step pipeline')

    const learnerProfile = await this.executeStep0(userConfig, params, difficultyConfig, aiConfig)

    const strategy = await this.executeStep1(learnerProfile, params, difficultyConfig, aiConfig)

    const planning = await this.executeStep2(learnerProfile, strategy, aiConfig)

    const charactersScenes = await this.executeStep3(learnerProfile, strategy, planning, aiConfig)

    const outline = await this.executeStep4(
      learnerProfile,
      strategy,
      planning,
      charactersScenes,
      aiConfig
    )

    const chapterStructures = await this.executeStep5(
      learnerProfile,
      strategy,
      planning,
      charactersScenes,
      outline,
      aiConfig
    )

    const chapters = await this.executeStep6(
      learnerProfile,
      planning,
      charactersScenes,
      chapterStructures,
      difficultyConfig,
      aiConfig,
      userConfig.englishVariant
    )

    const vocabulary = await this.executeStep7(learnerProfile, chapters, userConfig, aiConfig)

    const tags = await this.executeStep8(
      learnerProfile,
      userConfig.nativeLanguage,
      outline.title,
      chapters,
      aiConfig
    )

    return await this.saveBook(userId, params, {
      title: outline.title,
      chapters,
      vocabulary: vocabulary.vocabulary,
      tags: tags.tags,
    })
  }

  private async executeStep0(
    userConfig: FullUserConfig,
    params: GenerateBookParams,
    config: DifficultyConfig,
    aiConfig: AiClientConfig
  ): Promise<LearnerProfile> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/00-learner-profile', {
      nativeLanguage: userConfig.nativeLanguage,
      targetLanguage: userConfig.targetLanguage,
      englishVariant: userConfig.englishVariant,
      vocabularyLevel: userConfig.vocabularyLevel,
      difficultyLevel: params.difficultyLevel,
      difficultyDescription: config.description,
    })

    logger.info({ step: 0 }, 'Step 0: Learner profile generation')

    const response = await this.aiService.chatJson<LearnerProfile>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 800,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 0, background: response.languageTransfer }, 'Step 0 completed')

    return response
  }

  private async executeStep1(
    learnerProfile: LearnerProfile,
    params: GenerateBookParams,
    config: DifficultyConfig,
    aiConfig: AiClientConfig
  ): Promise<BookStrategy> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/01-strategy', {
      learnerProfile: JSON.stringify(learnerProfile),
      topic: params.topic,
      level: params.difficultyLevel,
      levelDescription: config.description,
      extraInstructions: params.extraInstructions || '',
    })

    logger.info({ step: 1, topic: params.topic }, 'Step 1: Strategy analysis')

    const response = await this.aiService.chatJson<BookStrategy>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1000,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 1, strategy: response }, 'Step 1 completed')

    return response
  }

  private async executeStep2(
    learnerProfile: LearnerProfile,
    strategy: BookStrategy,
    aiConfig: AiClientConfig
  ): Promise<AiPlanning> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/02-planning', {
      learnerProfile: JSON.stringify(learnerProfile),
      strategy: JSON.stringify(strategy),
    })

    logger.info({ step: 2, strategy: strategy.primaryOutputType }, 'Step 2: AI self-planning')

    const response = await this.aiService.chatJson<AiPlanning>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1000,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 2, boundaries: response.mustFollowRules?.length ?? 0 }, 'Step 2 completed')

    return response
  }

  private async executeStep3(
    learnerProfile: LearnerProfile,
    strategy: BookStrategy,
    planning: AiPlanning,
    aiConfig: AiClientConfig
  ): Promise<CharactersAndScenes> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/03-characters-scenes', {
      learnerProfile: JSON.stringify(learnerProfile),
      strategy: JSON.stringify(strategy),
      planning: JSON.stringify(planning),
    })

    logger.info({ step: 3 }, 'Step 3: Characters and scenes design')

    const response = await this.aiService.chatJson<CharactersAndScenes>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1200,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info(
      { step: 3, characters: response.characters.length, scenes: response.scenes.length },
      'Step 3 completed'
    )

    return response
  }

  private async executeStep4(
    learnerProfile: LearnerProfile,
    strategy: BookStrategy,
    planning: AiPlanning,
    charactersScenes: CharactersAndScenes,
    aiConfig: AiClientConfig
  ): Promise<BookOutline> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/04-outline', {
      learnerProfile: JSON.stringify(learnerProfile),
      strategy: JSON.stringify(strategy),
      planning: JSON.stringify(planning),
      charactersScenes: JSON.stringify(charactersScenes),
    })

    logger.info({ step: 4, strategy: strategy.primaryOutputType }, 'Step 4: Outline generation')

    const response = await this.aiService.chatJson<BookOutline>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info(
      { step: 4, outline: response.title, chapters: response.chapters.length },
      'Step 4 completed'
    )

    return response
  }

  private async executeStep5(
    learnerProfile: LearnerProfile,
    strategy: BookStrategy,
    planning: AiPlanning,
    charactersScenes: CharactersAndScenes,
    outline: BookOutline,
    aiConfig: AiClientConfig
  ): Promise<AllChapterStructures> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/05-chapter-structure', {
      learnerProfile: JSON.stringify(learnerProfile),
      strategy: JSON.stringify(strategy),
      planning: JSON.stringify(planning),
      charactersScenes: JSON.stringify(charactersScenes),
      outline: JSON.stringify(outline),
    })

    logger.info(
      { step: 5, chapterCount: outline.chapters.length },
      'Step 5: Chapter structure planning'
    )

    const response = await this.aiService.chatJson<AllChapterStructures>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 2000,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 5, chapters: response.chapters.length }, 'Step 5 completed')

    return response
  }

  private async executeStep6(
    learnerProfile: LearnerProfile,
    planning: AiPlanning,
    charactersScenes: CharactersAndScenes,
    chapterStructures: AllChapterStructures,
    config: DifficultyConfig,
    aiConfig: AiClientConfig,
    englishVariant: string
  ): Promise<ChapterContent[]> {
    const systemPrompt = this.promptService.render('system', {})

    const generateChapter = async (chapterStructure: ChapterStructure): Promise<ChapterContent> => {
      const prompt = this.promptService.render('book/06-content', {
        learnerProfile: JSON.stringify(learnerProfile),
        planning: JSON.stringify(planning),
        charactersScenes: JSON.stringify(charactersScenes),
        chapterStructure: JSON.stringify(chapterStructure),
        chapterIndex: chapterStructure.index,
        englishVariant,
      })

      logger.info({ step: 6, chapter: chapterStructure.index }, 'Step 6: Content generation')

      const response = await this.aiService.chatJson<ChapterContent>(aiConfig, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        maxTokens: config.maxTokens,
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
      })

      logger.info(
        { step: 6, chapter: chapterStructure.index, wordCount: response.wordCount },
        'Step 6 chapter completed'
      )

      return response
    }

    const chapters = await Promise.all(chapterStructures.chapters.map(generateChapter))

    return chapters.sort((a, b) => a.index - b.index)
  }

  private async executeStep7(
    learnerProfile: LearnerProfile,
    chapters: ChapterContent[],
    userConfig: FullUserConfig,
    aiConfig: AiClientConfig
  ): Promise<Vocabulary> {
    const systemPrompt = this.promptService.render('system', {})
    const prompt = this.promptService.render('book/07-vocabulary', {
      learnerProfile: JSON.stringify(learnerProfile),
      chapters: JSON.stringify(chapters),
      nativeLanguage: userConfig.nativeLanguage,
      englishVariant: userConfig.englishVariant,
    })

    logger.info({ step: 7, chapterCount: chapters.length }, 'Step 7: Vocabulary extraction')

    const response = await this.aiService.chatJson<Vocabulary>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1500,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 7, vocabulary: response.vocabulary.length }, 'Step 7 completed')

    return response
  }

  private async executeStep8(
    learnerProfile: LearnerProfile,
    nativeLanguage: string,
    title: string,
    chapters: ChapterContent[],
    aiConfig: AiClientConfig
  ): Promise<BookTags> {
    const systemPrompt = this.promptService.render('system', {})

    const chapterSummaries = chapters
      .map((c) => `${c.title}: ${c.content.substring(0, 200)}...`)
      .join('\n')

    const prompt = this.promptService.render('book/08-tags', {
      title,
      nativeLanguage,
      chapterSummaries,
      learnerProfile: JSON.stringify(learnerProfile),
    })

    logger.info({ step: 8, title }, 'Step 8: Tag generation')

    const response = await this.aiService.chatJson<BookTags>(aiConfig, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      maxTokens: 500,
      temperature: 0.7,
      responseFormat: { type: 'json_object' },
    })

    logger.info({ step: 8, tags: response.tags.length }, 'Step 8 completed')

    return response
  }

  private async saveBook(
    userId: number,
    params: GenerateBookParams,
    data: {
      title: string
      chapters: ChapterContent[]
      vocabulary: Vocabulary['vocabulary']
      tags: BookTags['tags']
    }
  ): Promise<Book> {
    const wordCount = data.chapters.reduce((sum, c) => sum + c.wordCount, 0)

    return await db.transaction(async (trx) => {
      const book = await Book.create(
        {
          title: data.title,
          difficultyLevel: params.difficultyLevel,
          wordCount,
          readingTime: Math.ceil(wordCount / ARTICLE_CONTENT.READING_SPEED),
          isPublished: true,
          createdBy: userId,
        },
        { client: trx }
      )

      logger.debug('[Book Generation] Book created', { id: book.id, title: book.title })

      const chaptersData = data.chapters.map((chapter) => ({
        bookId: book.id,
        chapterIndex: chapter.index,
        title: chapter.title,
        content: chapter.content,
      }))
      await BookChapter.createMany(chaptersData, { client: trx })
      logger.info({ bookId: book.id, chapterCount: chaptersData.length }, 'Chapters saved')

      const tags = await this.processTags(data.tags, trx)
      await book.related('tags').attach(
        tags.map((t) => t.id),
        trx
      )

      if (data.vocabulary && data.vocabulary.length > 0) {
        const vocabularyData = data.vocabulary.map((item) => ({
          bookId: book.id,
          word: item.word,
          meaning: item.meaning,
          sentence: item.sentence,
          phonetic: item.phonetic || null,
        }))
        await BookVocabulary.createMany(vocabularyData, { client: trx })
        logger.info({ bookId: book.id, vocabularyCount: vocabularyData.length }, 'Vocabulary saved')
      }

      await book.load('tags')

      logger.info({ bookId: book.id, tagCount: tags.length }, 'Book generated successfully')

      return book
    })
  }

  private async processTags(
    aiTags: Array<{ name: string; isNew: boolean }>,
    trx: unknown
  ): Promise<Tag[]> {
    const tags: Tag[] = []
    for (const aiTag of aiTags) {
      const tag = await this.tagService.findOrCreateByName(aiTag.name, trx)
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
