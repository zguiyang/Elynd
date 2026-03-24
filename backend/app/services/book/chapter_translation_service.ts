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

  async getStatus(translationId: number): Promise<{
    translationId: number
    status: string
    errorMessage: string | null
  }> {
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

  async getProgress(translationId: number): Promise<{
    translationId: number
    status: string
    totalParagraphs: number
    completedParagraphs: number
    title: { original: string; translated: string }
    paragraphs: Array<{
      paragraphIndex: number
      status: string
      sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
      error?: string
    }>
  } | null> {
    const progressKey = `${CHAPTER_TRANSLATION.PROGRESS_PREFIX}:${translationId}`
    const raw = await redis.get(progressKey)

    if (!raw) {
      // Fall back to database status
      const translation = await ChapterTranslation.find(translationId)
      if (!translation) return null

      return {
        translationId,
        status: translation.status,
        totalParagraphs: 0,
        completedParagraphs: 0,
        title: { original: '', translated: '' },
        paragraphs: [],
      }
    }

    return JSON.parse(raw)
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

    // Declare progress with explicit type so it's accessible in catch block
    type ParagraphProgress = {
      paragraphIndex: number
      status: 'pending' | 'completed' | 'failed'
      sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
      error?: string
    }
    type ProgressType = {
      totalParagraphs: number
      completedParagraphs: number
      title: { original: string; translated: string }
      paragraphs: ParagraphProgress[]
      overallStatus: 'processing' | 'completed' | 'failed'
    }
    let progress: ProgressType | undefined

    try {
      const aiConfig = await this.configService.getAiConfig()
      const paragraphs = this.splitContentIntoParagraphs(chapter.content)

      // Initialize progress
      progress = {
        totalParagraphs: paragraphs.length,
        completedParagraphs: 0,
        title: { original: chapter.title, translated: '' },
        paragraphs: paragraphs.map((_, i) => ({
          paragraphIndex: i,
          status: 'pending' as const,
        })),
        overallStatus: 'processing' as const,
      }

      await this.writeTranslationProgress(translationId, progress)

      // Translate title first
      const titlePrompt = this.promptService.render('book/chapter-translation-title', {
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        title: chapter.title,
      })

      const titleResult = await this.aiService.chatJson<{ title: { original: string; translated: string } }>(
        aiConfig,
        {
          messages: [
            { role: 'system', content: 'You are a translation engine. Always output valid JSON only.' },
            { role: 'user', content: titlePrompt },
          ],
          maxTokens: 500,
          temperature: 0.1,
          responseFormat: { type: 'json_object' },
        }
      )

      progress.title = titleResult.title
      await this.writeTranslationProgress(translationId, progress)

      // Translate paragraphs one by one
      for (let i = 0; i < paragraphs.length; i++) {
        try {
          const paragraphPrompt = this.promptService.render('book/chapter-translation-paragraph', {
            sourceLanguage: translation.sourceLanguage,
            targetLanguage: translation.targetLanguage,
            title: chapter.title,
            paragraphIndex: i + 1,
            totalParagraphs: paragraphs.length,
            paragraph: paragraphs[i],
          })

          const paragraphResult = await this.aiService.chatJson<{
            sentences: Array<{ sentenceIndex: number; original: string; translated: string }>
          }>(aiConfig, {
            messages: [
              { role: 'system', content: 'You are a translation engine. Always output valid JSON only.' },
              { role: 'user', content: paragraphPrompt },
            ],
            maxTokens: 4000,
            temperature: 0.1,
            responseFormat: { type: 'json_object' },
          })

          progress.paragraphs[i] = {
            paragraphIndex: i,
            status: 'completed',
            sentences: paragraphResult.sentences,
          }
          progress.completedParagraphs = i + 1
        } catch (error) {
          progress.paragraphs[i] = {
            paragraphIndex: i,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Translation failed',
          }
        }

        await this.writeTranslationProgress(translationId, progress)

        // Rate limiting: delay between paragraphs
        if (i < paragraphs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      // Finalize
      progress.overallStatus = 'completed'
      await this.writeTranslationProgress(translationId, progress)

      const result: ChapterTranslationResult = {
        title: progress.title,
        paragraphs: progress.paragraphs.map((p, i) => ({
          paragraphIndex: i,
          sentences: (p.sentences || []).map((s) => ({
            sentenceIndex: s.sentenceIndex,
            original: s.original,
            translated: s.translated,
            sourceOffsets: null,
            targetOffsets: null,
            tokensMap: null,
          })),
        })),
      }

      translation.status = 'completed'
      translation.provider = this.deriveProvider(aiConfig.baseUrl)
      translation.model = aiConfig.model
      translation.resultJson = result
      await translation.save()

      const cacheKey = this.buildCacheKey({
        bookId: chapter.bookId,
        chapterId: chapter.id,
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        contentHash: translation.contentHash,
      })
      await this.cacheResult(cacheKey, result)
    } catch (error) {
      translation.status = 'failed'
      translation.errorMessage = error instanceof Error ? error.message : 'Translation failed'
      await translation.save()

      // Try to write progress if it was initialized
      if (progress) {
        await this.writeTranslationProgress(translationId, {
          ...progress,
          overallStatus: 'failed',
        })
      }

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
      .whereIn('status', ['queued', 'processing'])
      .orderBy('updated_at', 'desc')
      .first()
  }

  private assertValidResult(result: ChapterTranslationResult) {
    if (!result || !result.title || !Array.isArray(result.paragraphs)) {
      throw new Error('Invalid translation schema')
    }
  }

  async writeTranslationProgress(
    translationId: number,
    progress: {
      totalParagraphs: number
      completedParagraphs: number
      title: { original: string; translated: string }
      paragraphs: Array<{
        paragraphIndex: number
        status: 'pending' | 'completed' | 'failed'
        sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
        error?: string
      }>
      overallStatus: 'processing' | 'completed' | 'failed'
    }
  ): Promise<void> {
    const key = `${CHAPTER_TRANSLATION.PROGRESS_PREFIX}:${translationId}`
    await redis.setex(key, CHAPTER_TRANSLATION.PROGRESS_TTL_SECONDS, JSON.stringify(progress))
  }

  private deriveProvider(baseUrl: string): string {
    const url = baseUrl.toLowerCase()
    if (url.includes('openai')) return 'openai'
    if (url.includes('anthropic')) return 'anthropic'
    if (url.includes('google')) return 'google'
    if (url.includes('azure')) return 'azure'
    return 'unknown'
  }

  private splitContentIntoParagraphs(content: string): string[] {
    const normalized = content.replace(/\r\n/g, '\n')
    const paragraphs = normalized.split('\n\n').map(p => p.trim()).filter(p => p.length > 0)
    return paragraphs
  }
}
