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

    const existing = await this.findLatestTranslation(chapter.id, identity)
    if (existing) {
      return this.resolveExistingTranslation(existing, cacheKey, params.userId)
    }

    let created: ChapterTranslation
    try {
      created = await ChapterTranslation.create({
        chapterId: chapter.id,
        sourceLanguage,
        targetLanguage,
        contentHash,
        status: 'queued',
        createdByUserId: params.userId,
      })
    } catch (error) {
      if (this.isIdentityUniqueViolation(error)) {
        const conflicted = await this.findLatestTranslation(chapter.id, identity)
        if (conflicted) {
          return this.resolveExistingTranslation(conflicted, cacheKey, params.userId)
        }
      }
      throw error
    }

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

    return {
      status: null,
      translationId: null,
      data: null,
    }
  }

  async processTranslation(translationId: number): Promise<void> {
    const logger = await import('@adonisjs/core/services/logger')

    const translation = await ChapterTranslation.find(translationId)
    if (!translation) {
      throw new Exception('Translation task not found', { status: 404 })
    }
    if (translation.status === 'completed') {
      logger.default.info({ translationId }, 'processTranslation: already completed, skipping')
      return
    }

    logger.default.info(
      { translationId, chapterId: translation.chapterId },
      'processTranslation: starting'
    )

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
      status: 'processing' | 'completed' | 'failed'
    }
    let progress: ProgressType | undefined

    try {
      const aiConfig = await this.configService.getAiConfig()
      const paragraphs = this.splitContentIntoParagraphs(chapter.content)
      const paragraphLengths = paragraphs.map((paragraph) => paragraph.length)
      const concurrency = this.deriveConcurrency(paragraphLengths)

      logger.default.info(
        { translationId, paragraphCount: paragraphs.length, concurrency },
        'processTranslation: initialized'
      )

      // Initialize progress
      progress = {
        totalParagraphs: paragraphs.length,
        completedParagraphs: 0,
        title: { original: chapter.title, translated: '' },
        paragraphs: paragraphs.map((_, i) => ({
          paragraphIndex: i,
          status: 'pending' as const,
        })),
        status: 'processing' as const,
      }

      await this.writeTranslationProgress(translationId, progress)
      logger.default.info({ translationId }, 'processTranslation: progress initialized in Redis')

      // Translate title first
      const titlePrompt = this.promptService.render('book/chapter-translation-title', {
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        title: chapter.title,
      })

      logger.default.info({ translationId }, 'processTranslation: calling AI for title translation')

      const titleResult = await this.aiService.chatJson<{
        title: { original: string; translated: string }
      }>(aiConfig, {
        messages: [
          {
            role: 'system',
            content: 'You are a translation engine. Always output valid JSON only.',
          },
          { role: 'user', content: titlePrompt },
        ],
        maxTokens: 500,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
      })

      progress.title = titleResult.title
      await this.writeTranslationProgress(translationId, progress)
      logger.default.info(
        { translationId, title: titleResult.title },
        'processTranslation: title translated'
      )

      // Translate paragraphs with dynamic concurrency
      let nextIndex = 0
      let completedCount = 0

      logger.default.info(
        { translationId, concurrency },
        'processTranslation: starting paragraph workers'
      )

      const runWorker = async () => {
        while (true) {
          const currentIndex = nextIndex
          nextIndex += 1
          if (currentIndex >= paragraphs.length) {
            return
          }

          try {
            const sentences = await this.translateParagraph(aiConfig, {
              sourceLanguage: translation.sourceLanguage,
              targetLanguage: translation.targetLanguage,
              title: chapter.title,
              paragraphIndex: currentIndex,
              totalParagraphs: paragraphs.length,
              paragraph: paragraphs[currentIndex],
            })

            progress!.paragraphs[currentIndex] = {
              paragraphIndex: currentIndex,
              status: 'completed',
              sentences,
            }
            logger.default.info(
              { translationId, paragraphIndex: currentIndex },
              'processTranslation: paragraph completed'
            )
          } catch (error) {
            progress!.paragraphs[currentIndex] = {
              paragraphIndex: currentIndex,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Translation failed',
            }
            logger.default.warn(
              {
                translationId,
                paragraphIndex: currentIndex,
                error: error instanceof Error ? error.message : 'Unknown',
              },
              'processTranslation: paragraph failed'
            )
          }

          completedCount += 1
          progress!.completedParagraphs = completedCount
          await this.writeTranslationProgress(translationId, progress!)

          // Rate limiting: delay between paragraphs
          if (currentIndex < paragraphs.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        }
      }

      await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
      logger.default.info({ translationId }, 'processTranslation: all paragraph workers finished')

      // Finalize
      progress.status = 'completed'
      await this.writeTranslationProgress(translationId, progress)

      const result = this.buildResult(progress)

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
      logger.default.info({ translationId }, 'processTranslation: completed and cached')
    } catch (error) {
      translation.status = 'failed'
      translation.errorMessage = error instanceof Error ? error.message : 'Translation failed'
      await translation.save()

      // Try to write progress if it was initialized
      if (progress) {
        await this.writeTranslationProgress(translationId, {
          ...progress,
          status: 'failed',
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

  private async findLatestTranslation(chapterId: number, identity: TranslationIdentity) {
    return ChapterTranslation.query()
      .where('chapter_id', chapterId)
      .andWhere('source_language', identity.sourceLanguage)
      .andWhere('target_language', identity.targetLanguage)
      .andWhere('content_hash', identity.contentHash)
      .orderBy('updated_at', 'desc')
      .first()
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

  private isIdentityUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const code = (error as { code?: string }).code
    const constraint = (error as { constraint?: string }).constraint
    return code === '23505' && constraint === 'chapter_translations_identity_unique'
  }

  private async resolveExistingTranslation(
    translation: ChapterTranslation,
    cacheKey: string,
    userId: number
  ): Promise<ChapterTranslationResponse> {
    if (translation.status === 'completed' && translation.resultJson) {
      await this.cacheResult(cacheKey, translation.resultJson)
      return {
        status: 'completed',
        translationId: translation.id,
        data: translation.resultJson,
      }
    }

    if (translation.status === 'queued' || translation.status === 'processing') {
      const recovered = await this.recoverStaleTranslation(translation)
      return {
        status: recovered ? 'queued' : translation.status,
        translationId: translation.id,
        data: null,
      }
    }

    if (translation.status === 'failed') {
      translation.status = 'queued'
      translation.errorMessage = null
      translation.resultJson = null
      translation.createdByUserId = userId
      await translation.save()

      await TranslateChapterJob.dispatch(
        { translationId: translation.id },
        { jobId: `chapter-translation-${translation.id}` }
      )

      return {
        status: 'queued',
        translationId: translation.id,
        data: null,
      }
    }

    return {
      status: translation.status,
      translationId: translation.id,
      data: null,
    }
  }

  private async recoverStaleTranslation(translation: ChapterTranslation): Promise<boolean> {
    if (translation.status !== 'queued' && translation.status !== 'processing') {
      return false
    }

    const hasProgress = await this.hasProgressSnapshot(translation.id)
    if (hasProgress) {
      return false
    }

    const staleThreshold =
      translation.status === 'queued'
        ? CHAPTER_TRANSLATION.STALE_QUEUED_REQUEUE_SECONDS
        : CHAPTER_TRANSLATION.STALE_PROCESSING_REQUEUE_SECONDS
    const ageSeconds = Math.max(0, Math.floor((Date.now() - translation.updatedAt.toMillis()) / 1000))
    if (ageSeconds < staleThreshold) {
      return false
    }

    if (translation.status === 'processing') {
      translation.status = 'queued'
      translation.errorMessage = null
    }
    await translation.save()

    await TranslateChapterJob.dispatch(
      { translationId: translation.id },
      { jobId: `chapter-translation-${translation.id}` }
    )

    return true
  }

  private async hasProgressSnapshot(translationId: number): Promise<boolean> {
    const key = `${CHAPTER_TRANSLATION.PROGRESS_PREFIX}:${translationId}`
    const exists = await redis.exists(key)
    return exists > 0
  }

  async retryParagraph(
    translationId: number,
    paragraphIndex: number
  ): Promise<{ translationId: number; paragraphIndex: number; status: 'queued' | 'processing' }> {
    const translation = await ChapterTranslation.find(translationId)
    if (!translation) {
      throw new Exception('Translation task not found', { status: 404 })
    }

    const progress = await this.getProgress(translationId)
    if (!progress) {
      throw new Exception('Translation progress not found', { status: 404 })
    }

    if (paragraphIndex < 0 || paragraphIndex >= progress.totalParagraphs) {
      throw new Exception('Invalid paragraph index', { status: 422 })
    }

    const current = progress.paragraphs[paragraphIndex]
    if (!current || current.status !== 'failed') {
      throw new Exception('Paragraph is not failed', { status: 409 })
    }

    progress.status = 'processing'
    progress.paragraphs[paragraphIndex] = {
      paragraphIndex,
      status: 'pending',
    }
    await this.writeTranslationProgress(translationId, progress as any)

    translation.status = 'processing'
    translation.errorMessage = null
    await translation.save()

    await TranslateChapterJob.dispatch(
      { translationId, paragraphIndex },
      { jobId: `chapter-translation-${translationId}-paragraph-${paragraphIndex}` }
    )

    return { translationId, paragraphIndex, status: 'queued' }
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
      status: 'processing' | 'completed' | 'failed'
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
    const paragraphs = normalized
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    return paragraphs
  }

  private deriveConcurrency(lengths: number[]): number {
    if (lengths.length === 0) return 1
    const avg = lengths.reduce((sum, length) => sum + length, 0) / lengths.length
    const avgCost = Math.ceil(avg / 800)
    const raw = Math.floor(5 - avgCost / 2)
    return Math.min(5, Math.max(1, raw))
  }

  private async translateParagraph(
    aiConfig: Awaited<ReturnType<ConfigService['getAiConfig']>>,
    input: {
      sourceLanguage: string
      targetLanguage: string
      title: string
      paragraphIndex: number
      totalParagraphs: number
      paragraph: string
    }
  ): Promise<Array<{ sentenceIndex: number; original: string; translated: string }>> {
    const paragraphPrompt = this.promptService.render('book/chapter-translation-paragraph', {
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      title: input.title,
      paragraphIndex: input.paragraphIndex + 1,
      totalParagraphs: input.totalParagraphs,
      paragraph: input.paragraph,
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

    return paragraphResult.sentences
  }

  async processParagraph(translationId: number, paragraphIndex: number): Promise<void> {
    const translation = await ChapterTranslation.find(translationId)
    if (!translation) {
      throw new Exception('Translation task not found', { status: 404 })
    }

    const chapter = await this.findReadableChapter(translation.chapterId)
    const paragraphs = this.splitContentIntoParagraphs(chapter.content)
    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) {
      throw new Exception('Invalid paragraph index', { status: 422 })
    }

    const progress = await this.getProgress(translationId)
    if (!progress) {
      throw new Exception('Translation progress not found', { status: 404 })
    }

    const aiConfig = await this.configService.getAiConfig()

    try {
      const sentences = await this.translateParagraph(aiConfig, {
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        title: chapter.title,
        paragraphIndex,
        totalParagraphs: paragraphs.length,
        paragraph: paragraphs[paragraphIndex],
      })

      progress.paragraphs[paragraphIndex] = {
        paragraphIndex,
        status: 'completed',
        sentences,
      }
    } catch (error) {
      progress.paragraphs[paragraphIndex] = {
        paragraphIndex,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Translation failed',
      }
    }

    progress.completedParagraphs = progress.paragraphs.filter((p) => p.status !== 'pending').length
    progress.status =
      progress.completedParagraphs >= progress.totalParagraphs ? 'completed' : 'processing'
    await this.writeTranslationProgress(translationId, progress as any)

    if (progress.status === 'completed') {
      const result = this.buildResult(progress)
      translation.status = 'completed'
      translation.resultJson = result
      translation.provider = this.deriveProvider(aiConfig.baseUrl)
      translation.model = aiConfig.model
      await translation.save()

      const cacheKey = this.buildCacheKey({
        bookId: chapter.bookId,
        chapterId: chapter.id,
        sourceLanguage: translation.sourceLanguage,
        targetLanguage: translation.targetLanguage,
        contentHash: translation.contentHash,
      })
      await this.cacheResult(cacheKey, result)
    } else {
      translation.status = 'processing'
      await translation.save()
    }
  }

  private buildResult(progress: {
    title: { original: string; translated: string }
    paragraphs: Array<{
      paragraphIndex: number
      sentences?: Array<{ sentenceIndex: number; original: string; translated: string }>
    }>
  }): ChapterTranslationResult {
    return {
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
  }
}
