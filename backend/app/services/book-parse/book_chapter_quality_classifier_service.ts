import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { BOOK_IMPORT_AI } from '#constants'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import PromptService from '#services/ai/prompt_service'
import { normalizeBookText } from '#utils/book_text_normalizer'
import type { AiChatParams, AiClientConfig } from '#types/ai'

export const CHAPTER_QUALITY_DECISIONS = {
  KEEP: 'keep_as_chapter',
  DROP_FRONT_MATTER: 'drop_front_matter',
  DROP_TOC: 'drop_toc',
  DROP_APPENDIX: 'drop_appendix',
  DROP_NOISE: 'drop_noise',
} as const

export type ChapterQualityDecision =
  (typeof CHAPTER_QUALITY_DECISIONS)[keyof typeof CHAPTER_QUALITY_DECISIONS]

export interface ChapterQualityReviewInput {
  chapterIndex: number
  title: string
  content: string
  previousTitle?: string | null
  nextTitle?: string | null
}

export interface ChapterQualityReviewResult {
  decision: ChapterQualityDecision
  confidence: number
  reason: string
  signals: string[]
  reviewedByAi: boolean
}

interface ChapterQualityReviewResponse {
  decision?: string
  confidence?: number
  reason?: string
  signals?: string[]
}

interface ChapterQualityAnalysis {
  shouldReview: boolean
  reason: string
  signals: string[]
  promptInput: ChapterQualityPromptInput
}

interface ChapterQualityPromptInput {
  chapterIndex: number
  title: string
  previousTitle: string | null
  nextTitle: string | null
  stats: {
    charCount: number
    wordCount: number
    lineCount: number
    paragraphCount: number
    sentenceCount: number
    uppercaseRatio: number
  }
  samples: {
    head: string
    middle: string
    tail: string
  }
  signals: string[]
}

@inject()
export class BookChapterQualityClassifierService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService
  ) {}

  async reviewChapter(input: ChapterQualityReviewInput): Promise<ChapterQualityReviewResult> {
    const analysis = this.analyzeChapter(input)
    if (!analysis.shouldReview) {
      return {
        decision: CHAPTER_QUALITY_DECISIONS.KEEP,
        confidence: 1,
        reason: analysis.reason,
        signals: analysis.signals,
        reviewedByAi: false,
      }
    }

    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('book/import/system', {})
    const userPrompt = this.promptService.render(
      'book/import/chapter-quality-classification',
      analysis.promptInput
    )
    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: BOOK_IMPORT_AI.JUDGE_MAX_TOKENS,
      temperature: 0,
      responseFormat: { type: 'json_object' },
    }

    try {
      const response = await this.aiService.chatJson<ChapterQualityReviewResponse>(aiConfig, params)
      return this.normalizeAiResult(response, analysis)
    } catch (error) {
      logger.warn(
        {
          err: error,
          chapterIndex: input.chapterIndex,
          title: input.title,
        },
        'Chapter quality classification failed, falling back to rule-based keep'
      )

      return {
        decision: CHAPTER_QUALITY_DECISIONS.KEEP,
        confidence: 0,
        reason: 'ai_review_failed',
        signals: analysis.signals,
        reviewedByAi: true,
      }
    }
  }

  private async resolveAiConfig(): Promise<AiClientConfig> {
    return this.configService.getAiConfig()
  }

  private normalizeAiResult(
    response: ChapterQualityReviewResponse,
    analysis: ChapterQualityAnalysis
  ): ChapterQualityReviewResult {
    const decision = this.normalizeDecision(response.decision)
    const confidence = this.normalizeConfidence(response.confidence)
    const reason = this.normalizeReason(response.reason, analysis.reason)
    const signals = this.normalizeSignals(response.signals, analysis.signals)

    return {
      decision,
      confidence,
      reason,
      signals,
      reviewedByAi: true,
    }
  }

  private normalizeDecision(decision: string | undefined): ChapterQualityDecision {
    const normalized = (decision || '').trim().toLowerCase()
    const values = Object.values(CHAPTER_QUALITY_DECISIONS)
    return values.includes(normalized as ChapterQualityDecision)
      ? (normalized as ChapterQualityDecision)
      : CHAPTER_QUALITY_DECISIONS.KEEP
  }

  private normalizeConfidence(confidence: unknown): number {
    const value = typeof confidence === 'number' ? confidence : Number(confidence)
    if (!Number.isFinite(value)) {
      return 0.5
    }

    return Math.max(0, Math.min(1, Number(value.toFixed(3))))
  }

  private normalizeReason(reason: unknown, fallback: string): string {
    if (typeof reason !== 'string') {
      return fallback
    }

    const trimmed = reason.trim()
    return trimmed || fallback
  }

  private normalizeSignals(signals: unknown, fallback: string[]): string[] {
    if (!Array.isArray(signals)) {
      return fallback
    }

    const normalized = signals
      .filter((signal): signal is string => typeof signal === 'string')
      .map((signal) => signal.trim())
      .filter(Boolean)

    return normalized.length > 0 ? normalized : fallback
  }

  private analyzeChapter(input: ChapterQualityReviewInput): ChapterQualityAnalysis {
    const normalizedContent = normalizeBookText(input.content)
    const stats = this.computeStats(normalizedContent)
    const signals = this.collectSignals(input.title, normalizedContent)
    const titleLooksChapterLike = this.isChapterLikeTitle(input.title)
    const shouldReview =
      signals.length > 0 ||
      (!titleLooksChapterLike && stats.wordCount < 240) ||
      (stats.uppercaseRatio >= 0.35 && stats.wordCount < 500) ||
      (stats.wordCount < 80 && stats.sentenceCount <= 1)

    return {
      shouldReview,
      reason: shouldReview ? 'gray_chapter_candidate' : 'clear_reading_chapter',
      signals,
      promptInput: {
        chapterIndex: input.chapterIndex,
        title: input.title,
        previousTitle: input.previousTitle || null,
        nextTitle: input.nextTitle || null,
        stats,
        samples: this.buildSamples(normalizedContent),
        signals,
      },
    }
  }

  private computeStats(content: string): ChapterQualityPromptInput['stats'] {
    const normalized = content.trim()
    const words = this.extractWords(normalized)
    const lines = normalized.split('\n')
    const lineCount = lines.filter((line) => line.trim().length > 0).length
    const paragraphs = normalized
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
    const sentenceCount = normalized.match(/[.!?]+/g)?.length || 0
    const letters = normalized.match(/[A-Za-z]/g)?.length || 0
    const uppercaseLetters = normalized.match(/[A-Z]/g)?.length || 0

    return {
      charCount: normalized.length,
      wordCount: words.length,
      lineCount,
      paragraphCount: paragraphs.length,
      sentenceCount,
      uppercaseRatio: letters > 0 ? Number((uppercaseLetters / letters).toFixed(3)) : 0,
    }
  }

  private buildSamples(content: string): ChapterQualityPromptInput['samples'] {
    const normalized = content.trim()
    if (!normalized) {
      return {
        head: '',
        middle: '',
        tail: '',
      }
    }

    const headChars = BOOK_IMPORT_AI.JUDGE_WINDOW_HEAD_CHARS
    const middleChars = BOOK_IMPORT_AI.JUDGE_WINDOW_MIDDLE_CHARS
    const tailChars = BOOK_IMPORT_AI.JUDGE_WINDOW_TAIL_CHARS
    const charCount = normalized.length

    const head = normalized.slice(0, Math.min(headChars, charCount)).trim()
    const middleStart = Math.max(0, Math.floor((charCount - middleChars) / 2))
    const middle = normalized
      .slice(middleStart, middleStart + Math.min(middleChars, charCount))
      .trim()
    const tail = normalized.slice(Math.max(0, charCount - tailChars)).trim()

    return { head, middle, tail }
  }

  private collectSignals(title: string, content: string): string[] {
    const signals: string[] = []
    const normalizedTitle = title.trim().toLowerCase()
    const normalizedContent = content.toLowerCase()

    if (
      /^(preface|foreword|copyright|contents|table of contents|acknowledgments?|dedication|index|appendix)\b/.test(
        normalizedTitle
      )
    ) {
      signals.push('noisy_title')
    }

    if (
      /first published|all rights reserved|printed and bound|publisher|publisher information|illustrated by|by [a-z]/i.test(
        normalizedContent
      )
    ) {
      signals.push('front_matter_keywords')
    }

    if (/^-{8,}$/.test(normalizedContent.replace(/\n/g, ''))) {
      signals.push('divider_only')
    }

    if (
      (normalizedContent.match(/\n/g)?.length || 0) === 0 &&
      normalizedContent.length < 200 &&
      !/[.!?]/.test(normalizedContent)
    ) {
      signals.push('single_block_short_content')
    }

    return signals
  }

  private isChapterLikeTitle(title: string): boolean {
    const normalizedTitle = title.trim().toLowerCase()
    return (
      /^(chapter|part|book)\b/.test(normalizedTitle) ||
      /^chapter\s+[0-9ivxlcdm]+\b/.test(normalizedTitle) ||
      /^chapter\s+\w+\b/.test(normalizedTitle)
    )
  }

  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/([a-z0-9])\-([a-z0-9])/g, '$1$2')
      .replace(/[—–]/g, ' ')
      .replace(/[^a-z0-9']+/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
  }
}
