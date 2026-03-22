import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import { dispatch } from 'adonisjs-jobs/services/main'
import redis from '@adonisjs/redis/services/main'
import { DICTIONARY } from '#constants'
import DictionaryEntryModel from '#models/dictionary_entry'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import PromptService from '#services/ai/prompt_service'
import { BookService } from '#services/book/book_service'
import { UserConfigService } from '#services/user/user_config_service'

const SOURCE_LANGUAGE = 'en'
const DEFAULT_LOCALIZATION_LANGUAGE = 'zh-CN'
const SAFE_LOOKUP_FAILURE_MESSAGE = '查询失败，请稍后重试'
const DICTIONARY_AI_SYSTEM_PROMPT = 'You are a bilingual dictionary engine. Return valid JSON only.'

type DictionaryExampleSourceType = 'dictionary' | 'article' | 'ai'
type DictionaryArticleExampleSourceType = 'article' | 'ai'
type DictionaryLookupMode = 'dictionary_only' | 'ai_enriched' | 'ai_fallback'
type DictionaryEnrichmentMode = 'enrich' | 'fallback'

interface FreeDictionaryApiSense {
  definition?: string
  examples?: string[]
}

interface FreeDictionaryApiEntry {
  partOfSpeech?: string
  pronunciations?: Array<{
    text?: string
    type?: string
    tags?: string[]
  }>
  senses?: FreeDictionaryApiSense[]
}

interface FreeDictionaryApiResponse {
  word?: string
  entries?: FreeDictionaryApiEntry[]
}

interface DictionaryBatchAiResponse {
  entries?: unknown[]
}

export interface DictionaryEnrichmentPayload {
  word: string
  userId?: number
  localizationLanguage?: string | null
  bookId?: number | null
  chapterIndex?: number | null
  mode: DictionaryEnrichmentMode
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
    source: 'dictionary'
    localizationLanguage: string
    lookupMode?: DictionaryLookupMode
  }
}

const CJK_TEXT_PATTERN = /[\u4e00-\u9fff]/

const hasChineseText = (value: string | null | undefined): boolean => {
  const text = value?.trim()
  if (!text) {
    return false
  }

  return CJK_TEXT_PATTERN.test(text)
}

export const isDictionaryEntryComplete = (entry: DictionaryEntry): boolean => {
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : []
  if (meanings.length === 0) {
    return false
  }

  const localizationLanguage =
    entry.localizationLanguage || entry.meta?.localizationLanguage || ''
  const requiresChineseLocalization = localizationLanguage.toLowerCase().startsWith('zh')

  return meanings.every((meaning) => {
    if (
      !meaning.partOfSpeech?.trim() ||
      !meaning.localizedMeaning?.trim() ||
      !meaning.plainExplanation?.trim() ||
      !Array.isArray(meaning.definitions) ||
      meaning.definitions.length === 0
    ) {
      return false
    }

    if (
      requiresChineseLocalization &&
      (!hasChineseText(meaning.localizedMeaning) || !hasChineseText(meaning.plainExplanation))
    ) {
      return false
    }

    return meaning.definitions.every((definition) => {
      if (
        requiresChineseLocalization &&
        (!hasChineseText(definition.localizedText) || !hasChineseText(definition.plainExplanation))
      ) {
        return false
      }

      return Boolean(
        definition.sourceText?.trim() &&
          definition.localizedText?.trim() &&
          definition.plainExplanation?.trim()
      )
    })
  })
}

export interface DictionaryLookupParams {
  word: string
  userId?: number
  localizationLanguage?: string | null
  bookId?: number | null
  chapterIndex?: number | null
  allowAiEnrichment?: boolean
}

interface DictionaryResolveOptions {
  userId?: number
  localizationLanguage?: string | null
}

interface DictionaryBatchLookupOptions {
  userId?: number
  localizationLanguage?: string | null
  concurrency?: number
  allowAiEnrichment?: boolean
}

interface DictionaryLookupResolution {
  entry: DictionaryEntry
  source: 'cache' | 'db' | 'upstream'
}

interface DictionaryArticleContext {
  bookId: number
  chapterIndex: number
  chapterTitle: string
  chapterSnippet: string
}

export interface DictionaryBatchLookupDiagnostics {
  totalWords: number
  succeededWords: number
  failedWords: Array<{ word: string; reason: string }>
  dictionaryOnlyWords: number
  aiEnrichedWords: number
  aiFallbackWords: number
  aiBatchFailedChunks: number
  aiBatchFailedWords: number
}

export interface DictionaryBatchLookupResult {
  entries: Map<string, DictionaryEntry | null>
  diagnostics: DictionaryBatchLookupDiagnostics
}

@inject()
export class DictionaryService {
  private freeDictionaryApiUrl: string

  constructor(
    private userConfigService: UserConfigService,
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private bookService: BookService
  ) {
    this.freeDictionaryApiUrl = env.get(
      'FREE_DICTIONARY_API_URL',
      'https://freedictionaryapi.com/api/v1'
    )
  }

  private getCacheKey(word: string, localizationLanguage: string): string {
    return `${DICTIONARY.CACHE_PREFIX}${localizationLanguage}:${word.toLowerCase()}`
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

  private async resolveLookupSettings(
    options: DictionaryResolveOptions = {}
  ): Promise<{ localizationLanguage: string }> {
    if (options.localizationLanguage) {
      return {
        localizationLanguage: this.normalizeLocalizationLanguage(options.localizationLanguage),
      }
    }

    if (options.userId === undefined || options.userId === null) {
      return {
        localizationLanguage: DEFAULT_LOCALIZATION_LANGUAGE,
      }
    }

    const userConfig = await this.userConfigService.getConfigByUserId(options.userId)

    return {
      localizationLanguage: this.normalizeLocalizationLanguage(userConfig?.nativeLanguage),
    }
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

  private normalizePhonetics(value: unknown): Array<{ text: string; audio?: string }> {
    if (typeof value === 'string') {
      try {
        return this.normalizePhonetics(JSON.parse(value))
      } catch {
        return []
      }
    }

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

        if (!sourceText || !localizedText) {
          return null
        }

        const source =
          item.source === 'dictionary' || item.source === 'article' || item.source === 'ai'
            ? item.source
            : 'dictionary'

        return {
          sourceText,
          localizedText,
          source,
        }
      })
      .filter((item): item is DictionaryLocalizedExample => item !== null)
  }

  private normalizeDefinitions(value: unknown): DictionaryDefinition[] {
    if (typeof value === 'string') {
      try {
        return this.normalizeDefinitions(JSON.parse(value))
      } catch {
        return []
      }
    }

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

        return {
          sourceText,
          localizedText,
          plainExplanation,
          examples: this.normalizeExamples(item.examples),
        }
      })
      .filter((item): item is DictionaryDefinition => item !== null)
  }

  private normalizeMeanings(value: unknown): DictionaryMeaning[] {
    if (typeof value === 'string') {
      try {
        return this.normalizeMeanings(JSON.parse(value))
      } catch {
        return []
      }
    }

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

        const definitions = this.normalizeDefinitions(item.definitions)
        const sourceMeaning =
          this.pickString(item.sourceMeaning) ||
          definitions[0]?.sourceText ||
          definitions[0]?.localizedText
        const localizedMeaning = this.pickString(item.localizedMeaning) || sourceMeaning
        const plainExplanation = this.pickString(item.plainExplanation) || localizedMeaning

        if (!sourceMeaning || !localizedMeaning || !plainExplanation) {
          return null
        }

        return {
          partOfSpeech,
          sourceMeaning,
          localizedMeaning,
          plainExplanation,
          definitions:
            definitions.length > 0
              ? definitions
              : [
                  {
                    sourceText: sourceMeaning,
                    localizedText: localizedMeaning,
                    plainExplanation,
                    examples: [],
                  },
                ],
        }
      })
      .filter((item): item is DictionaryMeaning => item !== null)
  }

  private normalizeArticleExamples(value: unknown): DictionaryArticleExample[] {
    if (typeof value === 'string') {
      try {
        return this.normalizeArticleExamples(JSON.parse(value))
      } catch {
        return []
      }
    }

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
        if (!sourceText || !localizedText) {
          return null
        }

        const source = item.source === 'article' || item.source === 'ai' ? item.source : 'article'

        return {
          sourceText,
          localizedText,
          source,
        }
      })
      .filter((item): item is DictionaryArticleExample => item !== null)
  }

  private normalizeAiDictionaryEntry(
    value: unknown,
    localizationLanguage: string
  ): DictionaryEntry | null {
    if (!this.isRecord(value)) {
      return null
    }

    const word = this.pickString(value.word)
    if (!word) {
      return null
    }

    const normalizedWord = this.normalizeWord(word)
    const sourceLanguage = this.pickString(value.sourceLanguage) || SOURCE_LANGUAGE
    const normalizedLocalizationLanguage = this.normalizeLocalizationLanguage(
      this.pickString(value.localizationLanguage) || localizationLanguage
    )
    const phonetics = this.normalizePhonetics(value.phonetics)
    const phonetic = this.pickString(value.phonetic) || phonetics[0]?.text || null
    const meanings = this.normalizeMeanings(value.meanings)
    const articleExamples = this.normalizeArticleExamples(value.articleExamples)

    if (meanings.length === 0) {
      const fallbackPartOfSpeech = this.pickString(value.partOfSpeech) || 'noun'
      const fallbackSourceMeaning =
        this.pickString(value.sourceMeaning) ||
        this.pickString(value.definition) ||
        this.pickString(value.localizedMeaning) ||
        normalizedWord
      const fallbackLocalizedMeaning =
        this.pickString(value.localizedMeaning) || '可能是专有名词、缩写、罕见词或拼写变体。'
      const fallbackPlainExplanation =
        this.pickString(value.plainExplanation) || fallbackLocalizedMeaning
      const fallbackDefinitions = this.normalizeDefinitions(value.definitions)

      return {
        word: normalizedWord,
        sourceLanguage,
        localizationLanguage: normalizedLocalizationLanguage,
        phonetic,
        phonetics,
        meanings: [
          {
            partOfSpeech: fallbackPartOfSpeech,
            sourceMeaning: fallbackSourceMeaning,
            localizedMeaning: fallbackLocalizedMeaning,
            plainExplanation: fallbackPlainExplanation,
            definitions:
              fallbackDefinitions.length > 0
                ? fallbackDefinitions
                : [
                    {
                      sourceText: fallbackSourceMeaning,
                      localizedText: fallbackLocalizedMeaning,
                      plainExplanation: fallbackPlainExplanation,
                      examples: [],
                    },
                  ],
          },
        ],
        articleExamples,
        meta: {
          source: 'dictionary',
          localizationLanguage: normalizedLocalizationLanguage,
        },
      }
    }

    return {
      word: normalizedWord,
      sourceLanguage,
      localizationLanguage: normalizedLocalizationLanguage,
      phonetic,
      phonetics,
      meanings,
      articleExamples,
      meta: {
        source: 'dictionary',
        localizationLanguage: normalizedLocalizationLanguage,
      },
    }
  }

  private normalizeAiDictionaryEntries(
    value: unknown,
    localizationLanguage: string
  ): DictionaryEntry[] {
    const payload = this.isRecord(value) && Array.isArray(value.entries) ? value.entries : value

    if (!Array.isArray(payload)) {
      return []
    }

    return payload
      .map((item) => this.normalizeAiDictionaryEntry(item, localizationLanguage))
      .filter((item): item is DictionaryEntry => item !== null)
  }

  private splitWordsIntoChunks(words: string[], maxChunkSize: number): string[][] {
    if (maxChunkSize <= 0) {
      return [words]
    }

    const chunks: string[][] = []
    for (let index = 0; index < words.length; index += maxChunkSize) {
      chunks.push(words.slice(index, index + maxChunkSize))
    }

    return chunks
  }

  private async generateAiDictionaryEntries(params: {
    words: string[]
    localizationLanguage: string
  }): Promise<DictionaryEntry[]> {
    if (params.words.length === 0) {
      return []
    }

    try {
      const aiConfig = await this.configService.getAiConfig()
      const contract = this.promptService.render('dictionary/batch-output-contract', {})
      const userPrompt = this.promptService.render('dictionary/batch-fallback', {
        words: params.words,
        sourceLanguage: SOURCE_LANGUAGE,
        localizationLanguage: params.localizationLanguage,
        contract,
      })

      const result = await this.aiService.chatJson<DictionaryBatchAiResponse>(aiConfig, {
        messages: [
          { role: 'system', content: DICTIONARY_AI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 3000,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })

      return this.normalizeAiDictionaryEntries(result, params.localizationLanguage)
    } catch (error) {
      logger.warn(
        {
          err: error,
          words: params.words,
          localizationLanguage: params.localizationLanguage,
        },
        'Dictionary AI batch generation failed'
      )
      return []
    }
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
        source: 'dictionary',
        localizationLanguage,
        lookupMode: 'dictionary_only',
      },
    }
  }

  private async getCachedEntry(
    word: string,
    localizationLanguage: string
  ): Promise<DictionaryEntry | null> {
    try {
      const cached = await redis.get(this.getCacheKey(word, localizationLanguage))
      if (!cached) {
        return null
      }

      const parsed = JSON.parse(cached) as DictionaryEntry
      if (!parsed || !parsed.word || parsed.localizationLanguage !== localizationLanguage) {
        return null
      }

      return parsed
    } catch (error) {
      logger.warn({ err: error, word, localizationLanguage }, 'Failed to read dictionary cache')
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
      await redis.setex(
        this.getCacheKey(word, localizationLanguage),
        ttlSeconds,
        JSON.stringify(entry)
      )
    } catch (error) {
      logger.warn({ err: error, word, localizationLanguage }, 'Failed to cache dictionary result')
    }
  }

  private async findDictionaryEntryRecord(params: {
    word: string
    localizationLanguage: string
  }): Promise<DictionaryEntryModel | null> {
    return await DictionaryEntryModel.query()
      .whereRaw('LOWER(word) = ?', [params.word])
      .where('localizationLanguage', params.localizationLanguage)
      .first()
  }

  private toDictionaryEntry(record: DictionaryEntryModel): DictionaryEntry {
    return {
      word: this.normalizeWord(record.word),
      sourceLanguage: record.sourceLanguage || SOURCE_LANGUAGE,
      localizationLanguage: record.localizationLanguage,
      phonetic: record.phonetic,
      phonetics: this.normalizePhonetics(record.phonetics),
      meanings: this.normalizeMeanings(record.meanings),
      articleExamples: this.normalizeArticleExamples(record.articleExamples),
      meta: {
        source: 'dictionary',
        localizationLanguage: record.localizationLanguage,
      },
    }
  }

  public async saveGlobalEntry(entry: DictionaryEntry): Promise<DictionaryEntryModel> {
    const normalizedWord = this.normalizeWord(entry.word)
    const localizationLanguage = this.normalizeLocalizationLanguage(entry.localizationLanguage)

    const existing = await this.findDictionaryEntryRecord({
      word: normalizedWord,
      localizationLanguage,
    })

    if (existing) {
      existing.merge({
        word: normalizedWord,
        sourceLanguage: entry.sourceLanguage || SOURCE_LANGUAGE,
        phonetic: entry.phonetic,
        phonetics: entry.phonetics,
        meanings: entry.meanings,
        articleExamples: entry.articleExamples,
        metaSource: 'dictionary',
      })
      await existing.save()
      return existing
    }

    return await DictionaryEntryModel.create({
      word: normalizedWord,
      localizationLanguage,
      sourceLanguage: entry.sourceLanguage || SOURCE_LANGUAGE,
      phonetic: entry.phonetic,
      phonetics: entry.phonetics,
      meanings: entry.meanings,
      articleExamples: entry.articleExamples,
      metaSource: 'dictionary',
    })
  }

  public async cacheEntry(entry: DictionaryEntry): Promise<void> {
    const normalizedWord = this.normalizeWord(entry.word)
    const localizationLanguage = this.normalizeLocalizationLanguage(entry.localizationLanguage)
    await this.setCachedEntry(normalizedWord, entry, localizationLanguage)
  }

  public async fetchUpstreamEntry(word: string): Promise<FreeDictionaryApiResponse | null> {
    return this.getEntry(word)
  }

  private async buildArticleContext(
    payload: DictionaryEnrichmentPayload
  ): Promise<DictionaryArticleContext | null> {
    if (
      payload.bookId === undefined ||
      payload.bookId === null ||
      payload.chapterIndex === undefined ||
      payload.chapterIndex === null
    ) {
      return null
    }

    try {
      const chapter = await this.bookService.getChapterByIndex(payload.bookId, payload.chapterIndex)

      return {
        bookId: payload.bookId,
        chapterIndex: payload.chapterIndex,
        chapterTitle: chapter.title,
        chapterSnippet: chapter.content.slice(0, 2000),
      }
    } catch (error) {
      logger.warn(
        {
          err: error,
          word: payload.word,
          bookId: payload.bookId,
          chapterIndex: payload.chapterIndex,
        },
        'Failed to build dictionary article context'
      )
      return null
    }
  }

  private async generateAiEnrichedEntry(params: {
    word: string
    localizationLanguage: string
    dictionarySnapshot: DictionaryEntry
    articleContext: DictionaryArticleContext | null
  }): Promise<DictionaryEntry | null> {
    try {
      const aiConfig = await this.configService.getAiConfig()
      const contract = this.promptService.render('dictionary/output-contract', {})
      const userPrompt = this.promptService.render('dictionary/enrich', {
        word: params.word,
        sourceLanguage: SOURCE_LANGUAGE,
        localizationLanguage: params.localizationLanguage,
        articleContext: params.articleContext,
        dictionarySnapshot: params.dictionarySnapshot,
        contract,
      })

      const result = await this.aiService.chatJson<unknown>(aiConfig, {
        messages: [
          { role: 'system', content: DICTIONARY_AI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2500,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })

      const entry = this.normalizeAiDictionaryEntry(result, params.localizationLanguage)
      if (!entry) {
        return null
      }

      entry.meta.lookupMode = 'ai_enriched'
      return entry
    } catch (error) {
      logger.warn(
        {
          err: error,
          word: params.word,
          localizationLanguage: params.localizationLanguage,
        },
        'Dictionary AI enrichment failed'
      )
      return null
    }
  }

  private async generateAiFallbackEntry(params: {
    word: string
    localizationLanguage: string
    articleContext: DictionaryArticleContext | null
  }): Promise<DictionaryEntry | null> {
    try {
      const aiConfig = await this.configService.getAiConfig()
      const contract = this.promptService.render('dictionary/output-contract', {})
      const userPrompt = this.promptService.render('dictionary/fallback', {
        word: params.word,
        sourceLanguage: SOURCE_LANGUAGE,
        localizationLanguage: params.localizationLanguage,
        articleContext: params.articleContext,
        contract,
      })

      const result = await this.aiService.chatJson<unknown>(aiConfig, {
        messages: [
          { role: 'system', content: DICTIONARY_AI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2500,
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
      })

      const entry = this.normalizeAiDictionaryEntry(result, params.localizationLanguage)
      if (!entry) {
        return null
      }

      entry.meta.lookupMode = 'ai_fallback'
      return entry
    } catch (error) {
      logger.warn(
        {
          err: error,
          word: params.word,
          localizationLanguage: params.localizationLanguage,
        },
        'Dictionary AI fallback failed'
      )
      return null
    }
  }

  private async resolveDictionaryCandidate(params: {
    word: string
    localizationLanguage: string
  }): Promise<DictionaryLookupResolution | null> {
    const cached = await this.getCachedEntry(params.word, params.localizationLanguage)
    if (cached) {
      return { entry: cached, source: 'cache' }
    }

    const dbEntry = await this.findDictionaryEntryRecord({
      word: params.word,
      localizationLanguage: params.localizationLanguage,
    })
    if (dbEntry) {
      const mapped = this.toDictionaryEntry(dbEntry)
      await this.setCachedEntry(params.word, mapped, params.localizationLanguage)
      return { entry: mapped, source: 'db' }
    }

    const upstreamEntry = await this.fetchUpstreamEntry(params.word)
    if (!upstreamEntry) {
      return null
    }

    const entry = this.buildDictionaryOnlyEntry(
      params.word,
      upstreamEntry,
      params.localizationLanguage
    )
    if (!entry) {
      return null
    }

    await this.saveGlobalEntry(entry)
    await this.setCachedEntry(params.word, entry, params.localizationLanguage)
    return { entry, source: 'upstream' }
  }

  public async queueDictionaryEnrichment(payload: DictionaryEnrichmentPayload): Promise<void> {
    const normalizedWord = this.normalizeWord(payload.word)
    const localizationLanguage = this.normalizeLocalizationLanguage(payload.localizationLanguage)
    const jobPayload: DictionaryEnrichmentPayload = {
      ...payload,
      word: normalizedWord,
      localizationLanguage,
    }
    const jobId = `${DICTIONARY.ENRICHMENT_JOB_PREFIX}-${jobPayload.mode}-${localizationLanguage}-${normalizedWord}`
    const { default: DictionaryEnrichmentJob } = await import('#jobs/dictionary_enrichment_job')

    logger.info(
      {
        word: normalizedWord,
        mode: jobPayload.mode,
        localizationLanguage,
        bookId: jobPayload.bookId ?? null,
        chapterIndex: jobPayload.chapterIndex ?? null,
        jobId,
      },
      'Dictionary enrichment job queued'
    )

    await dispatch(DictionaryEnrichmentJob, jobPayload, { jobId })
  }

  public async processAsyncEnrichment(payload: DictionaryEnrichmentPayload): Promise<void> {
    const normalizedWord = this.normalizeWord(payload.word)
    const settings = await this.resolveLookupSettings({
      userId: payload.userId,
      localizationLanguage: payload.localizationLanguage,
    })

    logger.info(
      {
        word: normalizedWord,
        mode: payload.mode,
        localizationLanguage: settings.localizationLanguage,
        bookId: payload.bookId ?? null,
        chapterIndex: payload.chapterIndex ?? null,
      },
      'Dictionary enrichment processing started'
    )

    const articleContext = await this.buildArticleContext({
      ...payload,
      word: normalizedWord,
      localizationLanguage: settings.localizationLanguage,
    })

    if (payload.mode === 'enrich') {
      const snapshot = await this.resolveDictionaryCandidate({
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
      })

      if (snapshot && isDictionaryEntryComplete(snapshot.entry)) {
        logger.info(
          {
            word: normalizedWord,
            localizationLanguage: settings.localizationLanguage,
            source: snapshot.source,
          },
          'Dictionary enrichment skipped because entry is complete'
        )
        return
      }

      const enriched = await this.generateAiEnrichedEntry({
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
        dictionarySnapshot: snapshot?.entry || {
          word: normalizedWord,
          sourceLanguage: SOURCE_LANGUAGE,
          localizationLanguage: settings.localizationLanguage,
          phonetic: null,
          phonetics: [],
          meanings: [],
          articleExamples: [],
          meta: {
            source: 'dictionary',
            localizationLanguage: settings.localizationLanguage,
          },
        },
        articleContext,
      })

      if (!enriched) {
        logger.info(
          {
            word: normalizedWord,
            localizationLanguage: settings.localizationLanguage,
          },
          'Dictionary enrichment produced no result'
        )
        return
      }

      await this.saveGlobalEntry(enriched)
      await this.setCachedEntry(normalizedWord, enriched, settings.localizationLanguage)
      logger.info(
        {
          word: normalizedWord,
          localizationLanguage: settings.localizationLanguage,
          lookupMode: enriched.meta.lookupMode,
        },
        'Dictionary enrichment completed'
      )
      return
    }

    const fallback = await this.generateAiFallbackEntry({
      word: normalizedWord,
      localizationLanguage: settings.localizationLanguage,
      articleContext,
    })

    if (!fallback) {
      logger.info(
        {
          word: normalizedWord,
          localizationLanguage: settings.localizationLanguage,
        },
        'Dictionary fallback enrichment produced no result'
      )
      return
    }

    await this.saveGlobalEntry(fallback)
    await this.setCachedEntry(normalizedWord, fallback, settings.localizationLanguage)
    logger.info(
      {
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
        lookupMode: fallback.meta.lookupMode,
      },
      'Dictionary fallback enrichment completed'
    )
  }

  private throwLookupFailure(error: unknown, word: string): never {
    logger.error({ err: error, word }, 'Dictionary lookup failed')
    throw new Exception(SAFE_LOOKUP_FAILURE_MESSAGE, { status: 503 })
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

    const normalizedWord = this.normalizeWord(params.word)

    try {
      const settings = await this.resolveLookupSettings({
        userId: params.userId,
        localizationLanguage: params.localizationLanguage,
      })

      const resolution = await this.resolveDictionaryCandidate({
        word: normalizedWord,
        localizationLanguage: settings.localizationLanguage,
      })

      if (!resolution) {
        logger.info(
          {
            word: normalizedWord,
            localizationLanguage: settings.localizationLanguage,
            mode: 'fallback',
          },
          'Dictionary lookup missed all sources, scheduling fallback enrichment'
        )
        void this.queueDictionaryEnrichment({
          word: normalizedWord,
          userId: params.userId,
          localizationLanguage: settings.localizationLanguage,
          bookId: params.bookId,
          chapterIndex: params.chapterIndex,
          mode: 'fallback',
        }).catch((error) => {
          logger.warn({ err: error, word: normalizedWord }, 'Failed to queue dictionary fallback')
        })
        throw new Error('Dictionary upstream entry not found')
      }

      if (!isDictionaryEntryComplete(resolution.entry)) {
        logger.info(
          {
            word: normalizedWord,
            localizationLanguage: settings.localizationLanguage,
            source: resolution.source,
            mode: 'enrich',
          },
          'Dictionary lookup returned incomplete entry, scheduling enrichment'
        )
        void this.queueDictionaryEnrichment({
          word: normalizedWord,
          userId: params.userId,
          localizationLanguage: settings.localizationLanguage,
          bookId: params.bookId,
          chapterIndex: params.chapterIndex,
          mode: 'enrich',
        }).catch((error) => {
          logger.warn({ err: error, word: normalizedWord }, 'Failed to queue dictionary enrichment')
        })
      }

      return resolution.entry
    } catch (error) {
      this.throwLookupFailure(error, normalizedWord)
    }
  }

  async lookupBatch(
    words: string[],
    concurrency: number = 5,
    options: DictionaryBatchLookupOptions = {}
  ): Promise<Map<string, DictionaryEntry | null>> {
    const detailed = await this.lookupBatchWithDiagnostics(words, concurrency, options)
    return detailed.entries
  }

  async lookupBatchWithDiagnostics(
    words: string[],
    concurrency: number = 5,
    options: DictionaryBatchLookupOptions = {}
  ): Promise<DictionaryBatchLookupResult> {
    const results = new Map<string, DictionaryEntry | null>()
    const normalizedWords = words.map((word) => this.normalizeWord(word)).filter((word) => word)
    const settings = await this.resolveLookupSettings({
      userId: options.userId,
      localizationLanguage: options.localizationLanguage,
    })
    const diagnostics: DictionaryBatchLookupDiagnostics = {
      totalWords: normalizedWords.length,
      succeededWords: 0,
      failedWords: [],
      dictionaryOnlyWords: 0,
      aiEnrichedWords: 0,
      aiFallbackWords: 0,
      aiBatchFailedChunks: 0,
      aiBatchFailedWords: 0,
    }

    if (normalizedWords.length === 0) {
      return {
        entries: results,
        diagnostics,
      }
    }

    const failedWordReasons = new Map<string, string>()

    const processWord = async (
      word: string
    ): Promise<[string, DictionaryEntry | null, string | null]> => {
      try {
        const entry = await this.lookup({
          word,
          userId: options.userId,
          localizationLanguage: settings.localizationLanguage,
        })
        return [word, entry, null]
      } catch (error) {
        return [word, null, error instanceof Error ? error.message : 'Unknown lookup failure']
      }
    }

    for (let i = 0; i < normalizedWords.length; i += concurrency) {
      const batch = normalizedWords.slice(i, i + concurrency)
      const batchResults = await Promise.all(batch.map(processWord))

      for (const [word, entry, reason] of batchResults) {
        results.set(word, entry)
        if (!entry) {
          failedWordReasons.set(word, reason || 'Unknown lookup failure')
          continue
        }

        diagnostics.succeededWords++
        const lookupMode = entry.meta.lookupMode
        if (lookupMode === 'dictionary_only') {
          diagnostics.dictionaryOnlyWords++
        } else if (lookupMode === 'ai_enriched') {
          diagnostics.aiEnrichedWords++
        } else if (lookupMode === 'ai_fallback') {
          diagnostics.aiFallbackWords++
        }
      }
    }

    if (options.allowAiEnrichment && failedWordReasons.size > 0) {
      const failedWords = Array.from(failedWordReasons.keys())
      const aiChunks = this.splitWordsIntoChunks(failedWords, 5)

      for (const chunk of aiChunks) {
        const repairedEntries = await this.generateAiDictionaryEntries({
          words: chunk,
          localizationLanguage: settings.localizationLanguage,
        })

        if (repairedEntries.length === 0) {
          diagnostics.aiBatchFailedChunks++
          diagnostics.aiBatchFailedWords += chunk.length
          continue
        }

        for (const entry of repairedEntries) {
          const normalizedWord = this.normalizeWord(entry.word)
          if (!failedWordReasons.has(normalizedWord)) {
            continue
          }

          await this.saveGlobalEntry(entry)
          await this.cacheEntry(entry)
          results.set(normalizedWord, entry)
          failedWordReasons.delete(normalizedWord)
          diagnostics.succeededWords++
          diagnostics.aiFallbackWords++
        }
      }
    }

    diagnostics.failedWords = Array.from(failedWordReasons.entries()).map(([word, reason]) => ({
      word,
      reason,
    }))

    return {
      entries: results,
      diagnostics,
    }
  }

  async refreshCache(
    word: string,
    localizationLanguage: string = DEFAULT_LOCALIZATION_LANGUAGE
  ): Promise<void> {
    const normalizedWord = this.normalizeWord(word)
    const normalizedLanguage = this.normalizeLocalizationLanguage(localizationLanguage)
    const cacheKey = this.getCacheKey(normalizedWord, normalizedLanguage)
    await redis.del(cacheKey)
    await this.lookup({
      word: normalizedWord,
      localizationLanguage: normalizedLanguage,
      allowAiEnrichment: false,
    })
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
