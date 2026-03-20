import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { createHash } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import ChapterTranslation from '#models/chapter_translation'
import BookChapter from '#models/book_chapter'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import PromptService from '#services/ai/prompt_service'
import TranslateChapterJob from '#jobs/translate_chapter_job'
import { CHAPTER_TRANSLATION } from '#constants'
import type {
  ChapterTranslationResult,
  ChapterTranslationResponse,
  RequestChapterTranslationParams,
} from '#types/chapter_translation'

interface TranslationIdentity {
  sourceLanguage: string
  targetLanguage: string
  contentHash: string
  promptVersion: string
}

@inject()
export class ChapterTranslationService {
  constructor(
    private aiService: AiService,
    private configService: ConfigService,
    private promptService: PromptService
  ) {}

  async requestTranslation(
    params: RequestChapterTranslationParams
  ): Promise<ChapterTranslationResponse> {
    const chapter = await this.findReadableChapter(params.chapterId)
    const sourceLanguage = params.sourceLanguage.trim()
    const targetLanguage = params.targetLanguage.trim()
    const contentHash = this.computeContentHash({
      title: chapter.title,
      content: chapter.content,
      sourceLanguage,
      targetLanguage,
    })
    const promptVersion = CHAPTER_TRANSLATION.PROMPT_VERSION
    const cacheKey = this.buildCacheKey({
      bookId: chapter.bookId,
      chapterId: chapter.id,
      sourceLanguage,
      targetLanguage,
      contentHash,
    })

    const cached = await this.getCachedResult(cacheKey)
    if (cached) {
      return {
        status: 'completed',
        translationId: null,
        data: cached,
      }
    }

    const identity: TranslationIdentity = {
      sourceLanguage,
      targetLanguage,
      contentHash,
      promptVersion,
    }

    const completed = await this.findCompletedTranslation(chapter.id, identity)
    if (completed?.resultJson) {
      await this.cacheResult(cacheKey, completed.resultJson)
      return {
        status: 'completed',
        translationId: completed.id,
        data: completed.resultJson,
      }
    }

    const active = await this.findActiveTranslation(chapter.id, identity)
    if (active) {
      return {
        status: active.status,
        translationId: active.id,
        data: null,
      }
    }

    const created = await ChapterTranslation.create({
      chapterId: chapter.id,
      sourceLanguage,
      targetLanguage,
      contentHash,
      promptVersion,
      status: 'queued',
      createdByUserId: params.userId,
    })

    await TranslateChapterJob.dispatch(
      { translationId: created.id },
      { jobId: `chapter-translation-${created.id}` }
    )

    return {
      status: 'queued',
      translationId: created.id,
      data: null,
    }
  }

  async getStatus(translationId: number) {
    const translation = await ChapterTranslation.find(translationId)
    if (!translation) {
      throw new Exception('Translation task not found', { status: 404 })
    }

    return {
      translationId: translation.id,
      status: translation.status,
      errorMessage: translation.errorMessage,
    }
  }

  async getChapterResult(params: {
    chapterId: number
    sourceLanguage: string
    targetLanguage: string
  }): Promise<ChapterTranslationResponse> {
    const chapter = await this.findReadableChapter(params.chapterId)
    const sourceLanguage = params.sourceLanguage.trim()
    const targetLanguage = params.targetLanguage.trim()
    const contentHash = this.computeContentHash({
      title: chapter.title,
      content: chapter.content,
      sourceLanguage,
      targetLanguage,
    })
    const promptVersion = CHAPTER_TRANSLATION.PROMPT_VERSION
    const cacheKey = this.buildCacheKey({
      bookId: chapter.bookId,
      chapterId: chapter.id,
      sourceLanguage,
      targetLanguage,
      contentHash,
    })

    const cached = await this.getCachedResult(cacheKey)
    if (cached) {
      return {
        status: 'completed',
        translationId: null,
        data: cached,
      }
    }

    const identity: TranslationIdentity = {
      sourceLanguage,
      targetLanguage,
      contentHash,
      promptVersion,
    }
    const completed = await this.findCompletedTranslation(chapter.id, identity)
    if (completed?.resultJson) {
      await this.cacheResult(cacheKey, completed.resultJson)
      return {
        status: 'completed',
        translationId: completed.id,
        data: completed.resultJson,
      }
    }

    const active = await this.findActiveTranslation(chapter.id, identity)
    if (active) {
      return {
        status: active.status,
        translationId: active.id,
        data: null,
      }
    }

    throw new Exception('Translation not found', { status: 404 })
  }

  async processTranslation(translationId: number): Promise<void> {
    const translation = await ChapterTranslation.find(translationId)
    if (!translation) {
      throw new Exception('Translation task not found', { status: 404 })
    }
    if (translation.status === 'completed') {
      return
    }

    const chapter = await this.findReadableChapter(translation.chapterId)
    translation.status = 'processing'
    translation.errorMessage = null
    await translation.save()

    try {
      const aiConfig = await this.configService.getAiConfig()
      const userPrompt = this.promptService.render('book/chapter-translation', {
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        title: chapter.title,
        content: chapter.content,
      })
      const result = await this.aiService.chatJson<ChapterTranslationResult>(aiConfig, {
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Always output valid JSON only. Do not include any explanation.',
          },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 16000,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      })

      this.assertValidResult(result)
      const cacheKey = this.buildCacheKey({
        bookId: chapter.bookId,
        chapterId: chapter.id,
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        contentHash: translation.contentHash,
      })

      translation.status = 'completed'
      translation.provider = 'openai'
      translation.model = aiConfig.model
      translation.resultJson = result
      translation.metadata = {
        modelVersion: aiConfig.model,
        cacheKey,
      }
      await translation.save()
      await this.cacheResult(cacheKey, result)
    } catch (error) {
      translation.status = 'failed'
      translation.errorMessage = error instanceof Error ? error.message : 'Translation failed'
      await translation.save()
      throw error
    }
  }

  private async findReadableChapter(chapterId: number): Promise<BookChapter> {
    const chapter = await BookChapter.query().where('id', chapterId).preload('book').first()

    if (!chapter || !chapter.book.isPublished) {
      throw new Exception('Chapter not found', { status: 404 })
    }

    return chapter
  }

  private computeContentHash(input: {
    title: string
    content: string
    sourceLanguage: string
    targetLanguage: string
  }) {
    return createHash('sha256')
      .update(`${input.sourceLanguage}::${input.targetLanguage}::${input.title}\n${input.content}`)
      .digest('hex')
  }

  private buildCacheKey(input: {
    bookId: number
    chapterId: number
    sourceLanguage: string
    targetLanguage: string
    contentHash: string
  }) {
    return [
      CHAPTER_TRANSLATION.CACHE_PREFIX,
      input.bookId,
      input.chapterId,
      input.sourceLanguage,
      input.targetLanguage,
      input.contentHash,
    ].join(':')
  }

  private async getCachedResult(cacheKey: string): Promise<ChapterTranslationResult | null> {
    const raw = await redis.get(cacheKey)
    if (!raw) {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as ChapterTranslationResult
      this.assertValidResult(parsed)
      return parsed
    } catch {
      await redis.del(cacheKey)
      return null
    }
  }

  private async cacheResult(cacheKey: string, result: ChapterTranslationResult) {
    await redis.setex(cacheKey, CHAPTER_TRANSLATION.RESULT_TTL_SECONDS, JSON.stringify(result))
  }

  private async findCompletedTranslation(chapterId: number, identity: TranslationIdentity) {
    return ChapterTranslation.query()
      .where('chapter_id', chapterId)
      .andWhere('source_language', identity.sourceLanguage)
      .andWhere('target_language', identity.targetLanguage)
      .andWhere('content_hash', identity.contentHash)
      .andWhere('prompt_version', identity.promptVersion)
      .andWhere('status', 'completed')
      .orderBy('updated_at', 'desc')
      .first()
  }

  private async findActiveTranslation(chapterId: number, identity: TranslationIdentity) {
    return ChapterTranslation.query()
      .where('chapter_id', chapterId)
      .andWhere('source_language', identity.sourceLanguage)
      .andWhere('target_language', identity.targetLanguage)
      .andWhere('content_hash', identity.contentHash)
      .andWhere('prompt_version', identity.promptVersion)
      .whereIn('status', ['queued', 'processing'])
      .orderBy('updated_at', 'desc')
      .first()
  }

  private assertValidResult(result: ChapterTranslationResult) {
    if (!result || !result.title || !Array.isArray(result.paragraphs)) {
      throw new Error('Invalid translation schema')
    }
  }
}
