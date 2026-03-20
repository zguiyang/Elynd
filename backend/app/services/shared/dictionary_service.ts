import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import redis from '@adonisjs/redis/services/main'
import { AI, DICTIONARY } from '#constants'
import BookChapter from '#models/book_chapter'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import PromptService from '#services/ai/prompt_service'
import { UserConfigService } from '#services/user/user_config_service'
import type { AiClientConfig } from '#types/ai'

const SOURCE_LANGUAGE = 'en'
const DEFAULT_LOCALIZATION_LANGUAGE = 'zh-CN'
const SAFE_LOOKUP_FAILURE_MESSAGE = '查询失败，请稍后重试'
const DICTIONARY_ENTRY_SOURCE = {
  DICTIONARY: 'dictionary',
  DICTIONARY_PLUS_AI: 'dictionary_plus_ai',
  AI_FALLBACK: 'ai_fallback',
} as const
const AI_OUTPUT_MODES = {
  ENRICH: 'enrich',
  FALLBACK: 'fallback',
} as const

type AiOutputMode = (typeof AI_OUTPUT_MODES)[keyof typeof AI_OUTPUT_MODES]
type DictionaryEntrySource = (typeof DICTIONARY_ENTRY_SOURCE)[keyof typeof DICTIONARY_ENTRY_SOURCE]
type DictionaryExampleSourceType = 'dictionary' | 'article' | 'ai'
type DictionaryArticleExampleSourceType = 'article' | 'ai'

interface FreeDictionaryApiSense {
  definition?: string
  examples?: string[]
}

interface FreeDictionaryApiEntry {
  language?: {
    code?: string
    name?: string
  }
  partOfSpeech?: string
  pronunciations?: Array<{
    text?: string
    type?: string
    tags?: string[]
  }>
  senses?: FreeDictionaryApiSense[]
  synonyms?: string[]
  antonyms?: string[]
}

interface FreeDictionaryApiResponse {
  word?: string
  entries?: FreeDictionaryApiEntry[]
}

interface DictionarySnapshotEntry {
  partOfSpeech: string
  pronunciations: string[]
  senses: Array<{
    definition: string
    examples: string[]
  }>
  synonyms: string[]
  antonyms: string[]
}

interface DictionarySnapshot {
  word: string
  sourceLanguage: string
  localizationLanguage: string
  entries: DictionarySnapshotEntry[]
}

interface DictionaryChapterContext {
  bookId: number
  chapterIndex: number
  chapterTitle: string
  chapterContent: string
}

interface DictionaryArticleContext {
  bookId: number
  chapterIndex: number
  chapterTitle: string
  sentences: string[]
  localizationLanguage: string
}

interface DictionaryLocalizedExample {
  sourceText: string
  localizedText: string
  source: DictionaryExampleSourceType
}

interface DictionaryArticleExample {
  sourceText: string
  localizedText: string
  source: DictionaryArticleExampleSourceType
}

interface DictionaryDefinition {
  sourceText: string
  localizedText: string
  plainExplanation: string
  examples: DictionaryLocalizedExample[]
}

interface DictionaryMeaning {
  partOfSpeech: string
  sourceMeaning: string
  localizedMeaning: string
  plainExplanation: string
  definitions: DictionaryDefinition[]
}

export interface DictionaryEntry {
  word: string
  sourceLanguage: string
  localizationLanguage: string
  phonetic: string | null
  phonetics: Array<{
    text: string
    audio?: string
  }>
  meanings: DictionaryMeaning[]
  articleExamples: DictionaryArticleExample[]
  meta: {
    source: DictionaryEntrySource
    localizationLanguage: string
  }
}

export interface DictionaryLookupParams {
  word: string
  userId?: number
  bookId?: number | null
  chapterIndex?: number | null
}

interface DictionaryResolveOptions {
  userId?: number
  bookId?: number | null
  chapterIndex?: number | null
  localizationLanguage?: string | null
  aiConfig?: AiClientConfig
}

interface DictionaryBatchLookupOptions {
  userId?: number
  bookId?: number | null
  chapterIndex?: number | null
  concurrency?: number
}

interface DictionaryContextOptions {
  bookId?: number | null
  chapterIndex?: number | null
}

interface DictionaryEnrichParams extends DictionaryLookupParams {
  baseEntry: FreeDictionaryApiResponse
  localizationLanguage?: string | null
  aiConfig?: AiClientConfig
  chapterContext?: DictionaryChapterContext | null
}

interface DictionaryFallbackParams extends DictionaryLookupParams {
  localizationLanguage?: string | null
  aiConfig?: AiClientConfig
  chapterContext?: DictionaryChapterContext | null
}

interface DictionaryLookupSettings {
  localizationLanguage: string
  aiConfig: AiClientConfig
}

interface DictionaryCacheRecord {
  localizationLanguage: string
  entry: DictionaryEntry
}

@inject()
export class DictionaryService {
  private freeDictionaryApiUrl: string
  private dictionaryOutputContract: string

  constructor(
    private aiService: AiService,
    private configService: ConfigService,
    private promptService: PromptService,
    private userConfigService: UserConfigService
  ) {
    this.freeDictionaryApiUrl = env.get(
      'FREE_DICTIONARY_API_URL',
      'https://freedictionaryapi.com/api/v1'
    )
    this.dictionaryOutputContract = this.promptService.render('dictionary/output-contract')
  }

  private getCacheKey(word: string): string {
    return `${DICTIONARY.CACHE_PREFIX}${word.toLowerCase()}`
  }

  private normalizeWord(word: string): string {
    return word.trim().toLowerCase()
  }

  private normalizeLocalizationLanguage(language?: string | null): string {
    const normalized = language?.trim()

    if (!normalized) {
      return DEFAULT_LOCALIZATION_LANGUAGE
    }

    const lower = normalized.toLowerCase()
    if (lower === 'zh' || lower === 'zh-cn') {
      return DEFAULT_LOCALIZATION_LANGUAGE
    }

    return normalized
  }

  private buildLookupAiConfig(config: AiClientConfig): AiClientConfig {
    return {
      ...config,
      timeout: Math.min(config.timeout ?? AI.DEFAULT_TIMEOUT, DICTIONARY.AI_TIMEOUT_MS),
      maxRetries:
        typeof config.maxRetries === 'number'
          ? Math.min(config.maxRetries, DICTIONARY.AI_MAX_RETRIES)
          : DICTIONARY.AI_MAX_RETRIES,
    }
  }

  private async resolveLookupSettings(
    options: DictionaryResolveOptions = {}
  ): Promise<DictionaryLookupSettings> {
    const aiConfig = this.buildLookupAiConfig(
      options.aiConfig || (await this.configService.getAiConfig())
    )

    if (options.localizationLanguage) {
      return {
        localizationLanguage: this.normalizeLocalizationLanguage(options.localizationLanguage),
        aiConfig,
      }
    }

    if (options.userId === undefined || options.userId === null) {
      return {
        localizationLanguage: DEFAULT_LOCALIZATION_LANGUAGE,
        aiConfig,
      }
    }

    const userConfig = await this.userConfigService.getConfigByUserId(options.userId)

    return {
      localizationLanguage: this.normalizeLocalizationLanguage(userConfig?.nativeLanguage),
      aiConfig,
    }
  }

  private async loadChapterContext(
    options: DictionaryContextOptions
  ): Promise<DictionaryChapterContext | null> {
    const startedAt = Date.now()

    if (options.bookId === undefined || options.bookId === null) {
      return null
    }

    if (options.chapterIndex === undefined || options.chapterIndex === null) {
      return null
    }

    const chapter = await BookChapter.query()
      .select('bookId', 'chapterIndex', 'title', 'content')
      .where('bookId', options.bookId)
      .where('chapterIndex', options.chapterIndex)
      .first()

    if (!chapter || !chapter.content?.trim()) {
      logger.info(
        {
          bookId: options.bookId,
          chapterIndex: options.chapterIndex,
          durationMs: Date.now() - startedAt,
          hit: false,
        },
        'Dictionary chapter context loaded'
      )
      return null
    }

    logger.info(
      {
        bookId: chapter.bookId,
        chapterIndex: chapter.chapterIndex,
        durationMs: Date.now() - startedAt,
        hit: true,
        chapterContentLength: chapter.content.length,
      },
      'Dictionary chapter context loaded'
    )

    return {
      bookId: chapter.bookId,
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.title,
      chapterContent: chapter.content,
    }
  }

  private extractCandidateSentences(content: string, word: string): string[] {
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\n+/g, ' ')
    const sentences = normalizedContent
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)

    if (sentences.length === 0) {
      return []
    }

    const escapedWord = this.escapeRegExp(word)
    const matcher = new RegExp(`(^|[^A-Za-z])${escapedWord}([^A-Za-z]|$)`, 'i')
    const matchedSentences = sentences.filter((sentence) => matcher.test(sentence))

    return (matchedSentences.length > 0 ? matchedSentences : sentences).slice(0, 5)
  }

  private buildArticleContext(
    word: string,
    chapterContext: DictionaryChapterContext | null,
    localizationLanguage: string
  ): DictionaryArticleContext | null {
    if (!chapterContext) {
      return null
    }

    const sentences = this.extractCandidateSentences(chapterContext.chapterContent, word)

    if (sentences.length === 0) {
      return null
    }

    return {
      bookId: chapterContext.bookId,
      chapterIndex: chapterContext.chapterIndex,
      chapterTitle: chapterContext.chapterTitle,
      sentences,
      localizationLanguage,
    }
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DICTIONARY.LOOKUP_TIMEOUT_MS)

    try {
      return await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }

  public async getEntry(word: string): Promise<FreeDictionaryApiResponse | null> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.freeDictionaryApiUrl}/entries/en/${encodeURIComponent(word)}?translations=false`
      )

      if (!response.ok) {
        logger.warn(
          { word, status: response.status },
          'Dictionary upstream returned non-ok response'
        )
        return null
      }

      const data = (await response.json()) as FreeDictionaryApiResponse

      if (!data || !Array.isArray(data.entries) || data.entries.length === 0) {
        return null
      }

      return data
    } catch (error) {
      logger.warn({ err: error, word }, 'Failed to fetch free dictionary entry')
      return null
    }
  }

  private buildSnapshot(
    word: string,
    response: FreeDictionaryApiResponse,
    localizationLanguage: string
  ): DictionarySnapshot {
    return {
      word,
      sourceLanguage: SOURCE_LANGUAGE,
      localizationLanguage,
      entries: (response.entries || [])
        .filter((entry) => typeof entry.partOfSpeech === 'string' && entry.partOfSpeech.trim())
        .map((entry) => ({
          partOfSpeech: entry.partOfSpeech!.trim(),
          pronunciations: (entry.pronunciations || [])
            .map((pronunciation) => pronunciation.text?.trim() || '')
            .filter((pronunciation) => pronunciation.length > 0),
          senses: (entry.senses || [])
            .map((sense) => ({
              definition: sense.definition?.trim() || '',
              examples: (sense.examples || [])
                .map((example) => example.trim())
                .filter((example) => example.length > 0),
            }))
            .filter((sense) => sense.definition.length > 0),
          synonyms: (entry.synonyms || [])
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
          antonyms: (entry.antonyms || [])
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        }))
        .filter((entry) => entry.senses.length > 0),
    }
  }

  private renderPrompt(mode: AiOutputMode, payload: Record<string, unknown>): string {
    return this.promptService.render(`dictionary/${mode}`, {
      contract: this.dictionaryOutputContract,
      ...payload,
    })
  }

  private normalizeDictionaryEntry(
    raw: unknown,
    word: string,
    localizationLanguage: string,
    source: DictionaryEntrySource
  ): DictionaryEntry {
    if (!this.isRecord(raw)) {
      throw new Error('AI returned an invalid dictionary payload')
    }

    const normalizedWord = this.pickString(raw.word) || word
    const phonetic = this.pickString(raw.phonetic)
    const phonetics = this.normalizePhonetics(raw.phonetics)
    const meanings = this.normalizeMeanings(raw.meanings)
    const articleExamples = this.normalizeArticleExamples(raw.articleExamples)

    if (meanings.length === 0) {
      throw new Error('AI returned an empty dictionary payload')
    }

    return {
      word: normalizedWord,
      sourceLanguage: this.pickString(raw.sourceLanguage) || SOURCE_LANGUAGE,
      localizationLanguage,
      phonetic: phonetic || phonetics[0]?.text || null,
      phonetics,
      meanings,
      articleExamples,
      meta: {
        source,
        localizationLanguage,
      },
    }
  }

  private normalizePhonetics(value: unknown): Array<{ text: string; audio?: string }> {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          const text = item.trim()
          return text ? { text } : null
        }

        if (!this.isRecord(item)) {
          return null
        }

        const text = this.pickString(item.text)
        const audio = this.pickString(item.audio)
        return text ? { text, audio: audio || undefined } : null
      })
      .filter((item): item is { text: string; audio?: string } => item !== null)
  }

  private normalizeMeanings(value: unknown): DictionaryMeaning[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => {
        if (!this.isRecord(item)) {
          return null
        }

        const partOfSpeech = this.pickString(item.partOfSpeech)
        if (!partOfSpeech) {
          return null
        }

        const sourceMeaningCandidate = this.pickString(item.sourceMeaning)
        const localizedMeaningCandidate = this.pickString(item.localizedMeaning)
        const plainExplanationCandidate = this.pickString(item.plainExplanation)
        const definitions = this.normalizeDefinitions(item.definitions)

        const sourceMeaning =
          sourceMeaningCandidate || definitions[0]?.sourceText || definitions[0]?.localizedText
        const localizedMeaning = localizedMeaningCandidate || sourceMeaning
        const plainExplanation = plainExplanationCandidate || localizedMeaning

        const normalizedDefinitions =
          definitions.length > 0
            ? definitions
            : sourceMeaning
              ? [
                  {
                    sourceText: sourceMeaning,
                    localizedText: localizedMeaning || sourceMeaning,
                    plainExplanation: plainExplanation || localizedMeaning || sourceMeaning,
                    examples: [],
                  },
                ]
              : []

        if (
          !sourceMeaning ||
          !localizedMeaning ||
          !plainExplanation ||
          normalizedDefinitions.length === 0
        ) {
          return null
        }

        return {
          partOfSpeech,
          sourceMeaning,
          localizedMeaning,
          plainExplanation,
          definitions: normalizedDefinitions,
        }
      })
      .filter((item): item is DictionaryMeaning => item !== null)
  }

  private normalizeDefinitions(value: unknown): DictionaryDefinition[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => {
        if (!this.isRecord(item)) {
          return null
        }

        const sourceText = this.pickString(item.sourceText) || this.pickString(item.localizedText)
        const localizedText = this.pickString(item.localizedText) || sourceText
        const plainExplanation = this.pickString(item.plainExplanation) || localizedText

        if (!sourceText || !localizedText || !plainExplanation) {
          return null
        }

        const examples = this.normalizeExamples(item.examples)

        return {
          sourceText,
          localizedText,
          plainExplanation,
          examples,
        }
      })
      .filter((item): item is DictionaryDefinition => item !== null)
  }

  private buildDictionaryOnlyEntry(
    word: string,
    upstream: FreeDictionaryApiResponse,
    localizationLanguage: string
  ): DictionaryEntry | null {
    const meanings: DictionaryMeaning[] = (upstream.entries || [])
      .map((entry) => {
        const partOfSpeech = this.pickString(entry.partOfSpeech)
        if (!partOfSpeech) {
          return null
        }

        const definitions: DictionaryDefinition[] = (entry.senses || [])
          .map((sense) => {
            const sourceText = this.pickString(sense.definition)
            if (!sourceText) {
              return null
            }

            const examples: DictionaryLocalizedExample[] = (sense.examples || [])
              .map((example) => this.pickString(example))
              .filter((example): example is string => Boolean(example))
              .map((example) => ({
                sourceText: example,
                localizedText: example,
                source: 'dictionary',
              }))

            return {
              sourceText,
              localizedText: sourceText,
              plainExplanation: sourceText,
              examples,
            }
          })
          .filter((definition): definition is DictionaryDefinition => definition !== null)

        if (definitions.length === 0) {
          return null
        }

        const sourceMeaning = definitions[0]!.sourceText

        return {
          partOfSpeech,
          sourceMeaning,
          localizedMeaning: sourceMeaning,
          plainExplanation: sourceMeaning,
          definitions,
        }
      })
      .filter((meaning): meaning is DictionaryMeaning => meaning !== null)

    if (meanings.length === 0) {
      return null
    }

    const phonetics = (upstream.entries || [])
      .flatMap((entry) => entry.pronunciations || [])
      .map((item) => this.pickString(item.text))
      .filter((item): item is string => Boolean(item))
      .map((text) => ({ text }))

    return {
      word,
      sourceLanguage: SOURCE_LANGUAGE,
      localizationLanguage,
      phonetic: phonetics[0]?.text || null,
      phonetics,
      meanings,
      articleExamples: [],
      meta: {
        source: DICTIONARY_ENTRY_SOURCE.DICTIONARY,
        localizationLanguage,
      },
    }
  }

  private normalizeExamples(value: unknown): DictionaryLocalizedExample[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => {
        if (!this.isRecord(item)) {
          return null
        }

        const sourceText = this.pickString(item.sourceText) || this.pickString(item.localizedText)
        const localizedText = this.pickString(item.localizedText) || sourceText
        const source = this.normalizeExampleSourceType(item.source || item.sourceType)

        if (!sourceText || !localizedText) {
          return null
        }

        return {
          sourceText,
          localizedText,
          source,
        }
      })
      .filter((item): item is DictionaryLocalizedExample => item !== null)
  }

  private normalizeArticleExamples(value: unknown): DictionaryArticleExample[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => {
        if (!this.isRecord(item)) {
          return null
        }

        const sourceText = this.pickString(item.sourceText) || this.pickString(item.localizedText)
        const localizedText = this.pickString(item.localizedText) || sourceText
        const source = this.normalizeArticleExampleSourceType(item.source || item.sourceType)

        if (!sourceText || !localizedText) {
          return null
        }

        return {
          sourceText,
          localizedText,
          source,
        }
      })
      .filter((item): item is DictionaryArticleExample => item !== null)
  }

  private normalizeExampleSourceType(value: unknown): DictionaryExampleSourceType {
    if (value === 'dictionary' || value === 'article' || value === 'ai') {
      return value
    }

    return 'ai'
  }

  private normalizeArticleExampleSourceType(value: unknown): DictionaryArticleExampleSourceType {
    if (value === 'article' || value === 'ai') {
      return value
    }

    return 'ai'
  }

  private pickString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private shouldCacheResult(
    localizationLanguage: string,
    chapterContext: DictionaryChapterContext | null
  ): boolean {
    return localizationLanguage === DEFAULT_LOCALIZATION_LANGUAGE && chapterContext === null
  }

  private async getCachedEntry(
    word: string,
    localizationLanguage: string,
    chapterContext: DictionaryChapterContext | null
  ): Promise<DictionaryEntry | null> {
    if (!this.shouldCacheResult(localizationLanguage, chapterContext)) {
      return null
    }

    try {
      const cached = await redis.get(this.getCacheKey(word))
      if (!cached) {
        return null
      }

      const parsed = JSON.parse(cached) as DictionaryCacheRecord
      if (
        !parsed ||
        parsed.localizationLanguage !== localizationLanguage ||
        !parsed.entry ||
        typeof parsed.entry.word !== 'string'
      ) {
        return null
      }

      return parsed.entry
    } catch (error) {
      logger.warn({ err: error, word }, 'Failed to read dictionary cache')
      return null
    }
  }

  private async setCachedEntry(
    word: string,
    entry: DictionaryEntry,
    localizationLanguage: string
  ): Promise<void> {
    try {
      const ttlSeconds = DICTIONARY.DEFAULT_TTL_DAYS * 24 * 60 * 60
      const payload: DictionaryCacheRecord = {
        localizationLanguage,
        entry,
      }

      await redis.setex(this.getCacheKey(word), ttlSeconds, JSON.stringify(payload))
      logger.debug({ word, ttlDays: DICTIONARY.DEFAULT_TTL_DAYS }, 'Dictionary result cached')
    } catch (error) {
      logger.warn({ err: error, word }, 'Failed to cache dictionary result')
    }
  }

  private async runEnrichWithAi(params: {
    word: string
    localizationLanguage: string
    aiConfig: AiClientConfig
    baseEntry: FreeDictionaryApiResponse
    chapterContext: DictionaryChapterContext | null
  }): Promise<DictionaryEntry> {
    const startedAt = Date.now()
    const articleContext = this.buildArticleContext(
      params.word,
      params.chapterContext,
      params.localizationLanguage
    )

    logger.info(
      {
        word: params.word,
        mode: AI_OUTPUT_MODES.ENRICH,
        hasArticleContext: Boolean(articleContext),
        articleSentenceCount: articleContext?.sentences.length || 0,
      },
      'Dictionary AI enrich started'
    )

    try {
      const raw = await this.aiService.chatJson<unknown>(params.aiConfig, {
        messages: [
          {
            role: 'system',
            content: this.renderPrompt(AI_OUTPUT_MODES.ENRICH, {
              word: params.word,
              sourceLanguage: SOURCE_LANGUAGE,
              localizationLanguage: params.localizationLanguage,
              dictionarySnapshot: this.buildSnapshot(
                params.word,
                params.baseEntry,
                params.localizationLanguage
              ),
              articleContext,
            }),
          },
        ],
        maxTokens: 2000,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })

      logger.info(
        {
          word: params.word,
          mode: AI_OUTPUT_MODES.ENRICH,
          durationMs: Date.now() - startedAt,
        },
        'Dictionary AI enrich completed'
      )

      return this.normalizeDictionaryEntry(
        raw,
        params.word,
        params.localizationLanguage,
        DICTIONARY_ENTRY_SOURCE.DICTIONARY_PLUS_AI
      )
    } catch (error) {
      logger.warn(
        {
          err: error,
          word: params.word,
          mode: AI_OUTPUT_MODES.ENRICH,
          durationMs: Date.now() - startedAt,
        },
        'Dictionary AI enrich failed'
      )
      throw error
    }
  }

  private async runFallbackWithAi(params: {
    word: string
    localizationLanguage: string
    aiConfig: AiClientConfig
    chapterContext: DictionaryChapterContext | null
  }): Promise<DictionaryEntry> {
    const startedAt = Date.now()
    const articleContext = this.buildArticleContext(
      params.word,
      params.chapterContext,
      params.localizationLanguage
    )

    logger.info(
      {
        word: params.word,
        mode: AI_OUTPUT_MODES.FALLBACK,
        hasArticleContext: Boolean(articleContext),
        articleSentenceCount: articleContext?.sentences.length || 0,
      },
      'Dictionary AI fallback started'
    )

    try {
      const raw = await this.aiService.chatJson<unknown>(params.aiConfig, {
        messages: [
          {
            role: 'system',
            content: this.renderPrompt(AI_OUTPUT_MODES.FALLBACK, {
              word: params.word,
              sourceLanguage: SOURCE_LANGUAGE,
              localizationLanguage: params.localizationLanguage,
              articleContext,
            }),
          },
        ],
        maxTokens: 2200,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })

      logger.info(
        {
          word: params.word,
          mode: AI_OUTPUT_MODES.FALLBACK,
          durationMs: Date.now() - startedAt,
        },
        'Dictionary AI fallback completed'
      )

      return this.normalizeDictionaryEntry(
        raw,
        params.word,
        params.localizationLanguage,
        DICTIONARY_ENTRY_SOURCE.AI_FALLBACK
      )
    } catch (error) {
      logger.warn(
        {
          err: error,
          word: params.word,
          mode: AI_OUTPUT_MODES.FALLBACK,
          durationMs: Date.now() - startedAt,
        },
        'Dictionary AI fallback failed'
      )
      throw error
    }
  }

  private async resolveAiInput(params: DictionaryLookupParams & DictionaryResolveOptions): Promise<{
    word: string
    localizationLanguage: string
    aiConfig: AiClientConfig
    chapterContext: DictionaryChapterContext | null
  }> {
    const normalizedWord = this.normalizeWord(params.word)
    const settings = await this.resolveLookupSettings({
      userId: params.userId,
      bookId: params.bookId,
      chapterIndex: params.chapterIndex,
      localizationLanguage: params.localizationLanguage,
      aiConfig: params.aiConfig,
    })
    const chapterContext = await this.loadChapterContext(params)

    return {
      word: normalizedWord,
      localizationLanguage: settings.localizationLanguage,
      aiConfig: settings.aiConfig,
      chapterContext,
    }
  }

  private async lookupWithResolvedSettings(params: {
    word: string
    localizationLanguage: string
    chapterContext: DictionaryChapterContext | null
  }): Promise<DictionaryEntry> {
    const startedAt = Date.now()
    const cachedEntry = await this.getCachedEntry(
      params.word,
      params.localizationLanguage,
      params.chapterContext
    )
    if (cachedEntry) {
      logger.info(
        { word: params.word, durationMs: Date.now() - startedAt, source: 'cache' },
        'Dictionary lookup completed'
      )
      return cachedEntry
    }

    let upstreamEntry: FreeDictionaryApiResponse | null = null
    const upstreamStartedAt = Date.now()
    try {
      upstreamEntry = await this.fetchUpstreamEntry(params.word)
      logger.info(
        {
          word: params.word,
          durationMs: Date.now() - upstreamStartedAt,
          hit: Boolean(upstreamEntry),
        },
        'Dictionary upstream lookup completed'
      )
    } catch (error) {
      logger.warn({ err: error, word: params.word }, 'Dictionary upstream lookup failed')
      upstreamEntry = null
    }

    if (!upstreamEntry) {
      logger.warn(
        {
          word: params.word,
          durationMs: Date.now() - startedAt,
          hasChapterContext: Boolean(params.chapterContext),
        },
        'Dictionary lookup failed after timing'
      )
      this.throwLookupFailure(new Error('Dictionary upstream entry not found'), params.word)
    }

    const entry = this.buildDictionaryOnlyEntry(
      params.word,
      upstreamEntry,
      params.localizationLanguage
    )
    if (!entry) {
      this.throwLookupFailure(
        new Error('Dictionary upstream entry cannot be normalized'),
        params.word
      )
    }

    if (this.shouldCacheResult(params.localizationLanguage, params.chapterContext)) {
      await this.setCachedEntry(params.word, entry, params.localizationLanguage)
    }

    logger.info(
      {
        word: params.word,
        durationMs: Date.now() - startedAt,
        source: DICTIONARY_ENTRY_SOURCE.DICTIONARY,
        hasChapterContext: Boolean(params.chapterContext),
      },
      'Dictionary lookup completed'
    )

    return entry
  }

  private throwLookupFailure(error: unknown, word: string): never {
    logger.error({ err: error, word }, 'Dictionary lookup failed')
    throw new Exception(SAFE_LOOKUP_FAILURE_MESSAGE, { status: 503 })
  }

  public async fetchUpstreamEntry(word: string): Promise<FreeDictionaryApiResponse | null> {
    return this.getEntry(word)
  }

  public async enrichWithAiCore(params: {
    word: string
    localizationLanguage: string
    aiConfig: AiClientConfig
    upstream: FreeDictionaryApiResponse
    chapterContext: DictionaryChapterContext | null
  }): Promise<DictionaryEntry> {
    return this.runEnrichWithAi({
      word: params.word,
      localizationLanguage: params.localizationLanguage,
      aiConfig: params.aiConfig,
      baseEntry: params.upstream,
      chapterContext: params.chapterContext,
    })
  }

  public async fallbackWithAiCore(params: {
    word: string
    localizationLanguage: string
    aiConfig: AiClientConfig
    chapterContext: DictionaryChapterContext | null
  }): Promise<DictionaryEntry> {
    return this.runFallbackWithAi(params)
  }

  async lookup(
    word: string,
    options?: Omit<DictionaryLookupParams, 'word'>
  ): Promise<DictionaryEntry>
  async lookup(params: DictionaryLookupParams): Promise<DictionaryEntry>
  async lookup(
    wordOrParams: string | DictionaryLookupParams,
    options?: Omit<DictionaryLookupParams, 'word'>
  ): Promise<DictionaryEntry> {
    const params: DictionaryLookupParams =
      typeof wordOrParams === 'string' ? { word: wordOrParams, ...(options || {}) } : wordOrParams

    try {
      const input = await this.resolveAiInput(params)
      return await this.lookupWithResolvedSettings({
        word: input.word,
        localizationLanguage: input.localizationLanguage,
        chapterContext: input.chapterContext,
      })
    } catch (error) {
      this.throwLookupFailure(error, this.normalizeWord(params.word))
    }
  }

  async enrichWithAi(params: DictionaryEnrichParams): Promise<DictionaryEntry> {
    const normalizedWord = this.normalizeWord(params.word)

    try {
      const settings = await this.resolveLookupSettings({
        userId: params.userId,
        localizationLanguage: params.localizationLanguage,
        aiConfig: params.aiConfig,
      })
      const chapterContext = params.chapterContext || (await this.loadChapterContext(params))
      const entry = await this.enrichWithAiCore({
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
        aiConfig: settings.aiConfig,
        upstream: params.baseEntry,
        chapterContext,
      })

      if (this.shouldCacheResult(settings.localizationLanguage, chapterContext)) {
        await this.setCachedEntry(normalizedWord, entry, settings.localizationLanguage)
      }

      return entry
    } catch (error) {
      this.throwLookupFailure(error, normalizedWord)
    }
  }

  async fallbackWithAi(params: DictionaryFallbackParams): Promise<DictionaryEntry> {
    const normalizedWord = this.normalizeWord(params.word)

    try {
      const settings = await this.resolveLookupSettings({
        userId: params.userId,
        localizationLanguage: params.localizationLanguage,
        aiConfig: params.aiConfig,
      })
      const chapterContext = params.chapterContext || (await this.loadChapterContext(params))
      const entry = await this.fallbackWithAiCore({
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
        aiConfig: settings.aiConfig,
        chapterContext,
      })

      if (this.shouldCacheResult(settings.localizationLanguage, chapterContext)) {
        await this.setCachedEntry(normalizedWord, entry, settings.localizationLanguage)
      }

      return entry
    } catch (error) {
      this.throwLookupFailure(error, normalizedWord)
    }
  }

  async lookupBatchWithAi(
    words: string[],
    options: DictionaryBatchLookupOptions = {}
  ): Promise<Map<string, DictionaryEntry | null>> {
    const results = new Map<string, DictionaryEntry | null>()
    const concurrency = options.concurrency || 5
    const normalizedWords = words.map((word) => this.normalizeWord(word)).filter((word) => word)

    if (normalizedWords.length === 0) {
      return results
    }

    const settings = await this.resolveLookupSettings({
      userId: options.userId,
    })
    const chapterContext = await this.loadChapterContext(options)

    const processWord = async (word: string): Promise<[string, DictionaryEntry | null]> => {
      try {
        const cachedEntry = await this.getCachedEntry(
          word,
          settings.localizationLanguage,
          chapterContext
        )
        if (cachedEntry) {
          return [word, cachedEntry]
        }

        let upstreamEntry: FreeDictionaryApiResponse | null = null
        try {
          upstreamEntry = await this.fetchUpstreamEntry(word)
        } catch (error) {
          logger.warn({ err: error, word }, 'Dictionary upstream lookup failed')
          upstreamEntry = null
        }

        const entry = upstreamEntry
          ? await this.enrichWithAiCore({
              word,
              localizationLanguage: settings.localizationLanguage,
              aiConfig: settings.aiConfig,
              upstream: upstreamEntry,
              chapterContext,
            })
          : await this.fallbackWithAiCore({
              word,
              localizationLanguage: settings.localizationLanguage,
              aiConfig: settings.aiConfig,
              chapterContext,
            })

        if (this.shouldCacheResult(settings.localizationLanguage, chapterContext)) {
          await this.setCachedEntry(word, entry, settings.localizationLanguage)
        }

        return [word, entry]
      } catch (error) {
        logger.warn({ err: error, word }, 'Dictionary batch lookup failed for word')
        return [word, null]
      }
    }

    for (let i = 0; i < normalizedWords.length; i += concurrency) {
      const batch = normalizedWords.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map(processWord))

      for (const [word, entry] of batchResults) {
        results.set(word, entry)
      }

      if (i + concurrency < normalizedWords.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    logger.info(
      {
        total: normalizedWords.length,
        successful: Array.from(results.values()).filter((value) => value !== null).length,
      },
      'Batch dictionary lookup completed'
    )

    return results
  }

  async lookupBatch(
    words: string[],
    concurrency: number = 5
  ): Promise<Map<string, DictionaryEntry | null>> {
    return await this.lookupBatchWithAi(words, { concurrency })
  }

  async refreshCache(word: string): Promise<void> {
    const normalizedWord = this.normalizeWord(word)
    const cacheKey = this.getCacheKey(normalizedWord)
    await redis.del(cacheKey)
    await this.lookup({ word: normalizedWord })
    logger.info({ word: normalizedWord }, 'Dictionary cache refreshed')
  }

  async getExpiringKeys(days: number = DICTIONARY.EXPIRING_DAYS): Promise<string[]> {
    try {
      const pattern = `${DICTIONARY.CACHE_PREFIX}*`
      const keys: string[] = []
      let cursor = '0'

      do {
        const [newCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = newCursor
        keys.push(...batch)
      } while (cursor !== '0')

      const expiringKeys: string[] = []
      const thresholdSeconds = days * 24 * 60 * 60

      for (const key of keys) {
        const ttl = await redis.ttl(key)
        if (ttl > 0 && ttl <= thresholdSeconds) {
          expiringKeys.push(key)
        }
      }

      return expiringKeys
    } catch (error) {
      logger.error({ err: error }, 'Failed to get expiring keys')
      return []
    }
  }
}
