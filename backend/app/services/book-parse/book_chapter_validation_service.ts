import { inject } from '@adonisjs/core'
import { AI, BOOK_IMPORT_AI } from '#constants'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai/ai_service'
import { ConfigService } from '#services/ai/config_service'
import PromptService from '#services/ai/prompt_service'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'
import type { AiChatParams, AiClientConfig } from '#types/ai'

export interface ChapterContentInput {
  chapterIndex: number
  title: string
  content: string
}

export interface ChapterValidationStats {
  totalChapters: number
  removedChapters: number
  fixedByRules: number
  fixedByAi: number
  reviewRetries: number
  mergedShortChapters: number
  reviewFailedChapterIndexes: number[]
  reviewScoreDigest: Array<{
    chapterIndex: number
    total: number
    passed: boolean
  }>
  ruleHits: {
    pgepubid: number
    htmlTag: number
    subheading: number
    duplicateTitle: number
    nonReading: number
  }
}

export interface ChapterValidationResult {
  chapters: ChapterContentInput[]
  stats: ChapterValidationStats
}

interface ChapterRepairResponse {
  content?: string
}

interface ChapterQualityScore {
  chapterIndex: number
  cleanliness: number
  semanticPreservation: number
  coherenceAfterMerge: number
  total: number
  passed: boolean
  reasons: string[]
}

interface ChapterQualityJudgeResponse {
  passed?: boolean
  chapterScores?: unknown
}

interface ChapterQualityJudgeResult {
  passed: boolean
  failedChapterIndexes: number[]
  chapterScores: ChapterQualityScore[]
}

const AI_CHAPTER_MAX_CHARS = 9000
const AI_CHUNK_MAX_CHARS = 4500
const REVIEW_RETRY_MAX = 1
const REVIEW_MIN_TOTAL_SCORE = 90
const SHORT_CHAPTER_WORD_THRESHOLD = 120
const SHORT_CHAPTER_CHAR_THRESHOLD = 700
const MAX_CONSECUTIVE_SHORT_MERGES = 2

@inject()
export class BookChapterValidationService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private contentGuardService: BookContentGuardService
  ) {}

  async validateChapters(chapters: ChapterContentInput[]): Promise<ChapterValidationResult> {
    const startedAt = Date.now()
    const stats: ChapterValidationStats = {
      totalChapters: chapters.length,
      removedChapters: 0,
      fixedByRules: 0,
      fixedByAi: 0,
      reviewRetries: 0,
      mergedShortChapters: 0,
      reviewFailedChapterIndexes: [],
      reviewScoreDigest: [],
      ruleHits: {
        pgepubid: 0,
        htmlTag: 0,
        subheading: 0,
        duplicateTitle: 0,
        nonReading: 0,
      },
    }

    const validated: ChapterContentInput[] = []
    logger.info({ chapterCount: chapters.length }, '[ChapterValidation] Step started')

    for (const chapter of chapters) {
      const normalized = this.normalizeChapter(chapter, stats)
      if (!this.shouldKeepChapter(normalized, stats)) {
        stats.removedChapters++
        continue
      }

      if (normalized.content !== this.normalizeNewlines(chapter.content)) {
        stats.fixedByRules++
      }

      const softIssues = this.collectSoftIssues(normalized.content)
      const initialHardErrors = this.validateHardConstraints(normalized.content)
      if (softIssues.length === 0 && initialHardErrors.length === 0) {
        validated.push({ ...normalized, chapterIndex: validated.length })
        continue
      }

      let candidate = normalized
      try {
        const repairedContent = await this.repairChapterWithAi(normalized, [
          ...initialHardErrors,
          ...softIssues,
        ])
        candidate = this.normalizeChapter({ ...normalized, content: repairedContent }, stats)
      } catch {
        candidate = normalized
      }

      let hardErrors = this.validateHardConstraints(candidate.content)

      if (hardErrors.includes('empty_body')) {
        const sourceBody = this.extractBody(normalized.content)
        if (sourceBody.length >= 50) {
          const recoveredBody = this.normalizeParagraphStructure(sourceBody)
          if (recoveredBody) {
            candidate = this.normalizeChapter(
              {
                ...candidate,
                content: recoveredBody,
              },
              stats
            )
            hardErrors = this.validateHardConstraints(candidate.content)
          }
        } else {
          stats.removedChapters++
          continue
        }
      }

      if (hardErrors.length > 0) {
        stats.removedChapters++
        continue
      }

      if (candidate.content !== normalized.content) {
        stats.fixedByAi++
      }
      validated.push({ ...candidate, chapterIndex: validated.length })
    }

    if (validated.length === 0) {
      throw new Error('No valid chapters remaining after chapter validation')
    }

    const mergeResult = this.mergeShortChapters(validated)
    stats.mergedShortChapters = mergeResult.mergedCount
    logger.info(
      { inputChapterCount: validated.length, mergedShortChapters: mergeResult.mergedCount },
      '[ChapterValidation] Short chapter merge completed'
    )

    let reviewedChapters = mergeResult.chapters
    const firstJudge = await this.judgeChapterQuality(reviewedChapters)
    let lastJudge = firstJudge

    if (!firstJudge.passed) {
      for (let attempt = 0; attempt < REVIEW_RETRY_MAX; attempt++) {
        stats.reviewRetries++
        logger.warn(
          {
            attempt: attempt + 1,
            maxAttempts: REVIEW_RETRY_MAX,
            failedChapterIndexes: firstJudge.failedChapterIndexes,
          },
          '[ChapterValidation] Review failed, entering in-step retry'
        )
        reviewedChapters = await this.repairAndRevalidateFailedChapters(
          reviewedChapters,
          firstJudge.failedChapterIndexes,
          firstJudge.chapterScores,
          stats
        )

        const retryJudge = await this.judgeChapterQuality(reviewedChapters)
        lastJudge = retryJudge
        if (retryJudge.passed) {
          break
        }

        if (attempt === REVIEW_RETRY_MAX - 1) {
          throw new Error(
            `Chapter quality review failed after retry. Failed chapters: ${retryJudge.failedChapterIndexes.join(',')}`
          )
        }
      }
    }
    stats.reviewFailedChapterIndexes = lastJudge.failedChapterIndexes
    stats.reviewScoreDigest = lastJudge.chapterScores.map((score) => ({
      chapterIndex: score.chapterIndex,
      total: score.total,
      passed: score.passed,
    }))

    const finalResult = {
      chapters: reviewedChapters.map((chapter, index) => ({ ...chapter, chapterIndex: index })),
      stats,
    }
    logger.info(
      {
        chapterCountIn: chapters.length,
        chapterCountOut: finalResult.chapters.length,
        removedChapters: stats.removedChapters,
        mergedShortChapters: stats.mergedShortChapters,
        reviewRetries: stats.reviewRetries,
        elapsedMs: Date.now() - startedAt,
      },
      '[ChapterValidation] Step completed'
    )
    return finalResult
  }

  private async repairAndRevalidateFailedChapters(
    chapters: ChapterContentInput[],
    failedIndexes: number[],
    chapterScores: ChapterQualityScore[],
    stats: ChapterValidationStats
  ): Promise<ChapterContentInput[]> {
    const failedSet = new Set(failedIndexes)
    const scoreMap = new Map(chapterScores.map((item) => [item.chapterIndex, item]))

    const repaired: ChapterContentInput[] = []
    for (const chapter of chapters) {
      if (!failedSet.has(chapter.chapterIndex)) {
        repaired.push(chapter)
        continue
      }

      const reasons = scoreMap.get(chapter.chapterIndex)?.reasons || []
      const repairedContent = await this.repairChapterWithAi(chapter, [
        'quality_review_failed',
        ...reasons,
      ])
      let normalized = this.normalizeChapter(
        {
          ...chapter,
          content: repairedContent,
        },
        stats
      )

      const hardErrors = this.validateHardConstraints(normalized.content)
      if (hardErrors.length > 0) {
        throw new Error(
          `Chapter ${chapter.chapterIndex} failed hard constraints after review retry: ${hardErrors.join(',')}`
        )
      }

      if (normalized.content !== chapter.content) {
        stats.fixedByAi++
      }
      normalized = {
        ...normalized,
        chapterIndex: chapter.chapterIndex,
      }
      repaired.push(normalized)
    }

    return repaired
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .map((chapter, index) => ({ ...chapter, chapterIndex: index }))
  }

  private async judgeChapterQuality(
    chapters: ChapterContentInput[]
  ): Promise<ChapterQualityJudgeResult> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/chapter-quality-judge', {
      minTotalScore: REVIEW_MIN_TOTAL_SCORE,
      chapters: chapters.map((chapter) => ({
        chapterIndex: chapter.chapterIndex,
        title: chapter.title,
        content: this.buildJudgeContentWindow(chapter.content),
      })),
    })

    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: BOOK_IMPORT_AI.JUDGE_MAX_TOKENS,
      temperature: 0,
      responseFormat: { type: 'json_object' },
    }
    const startedAt = Date.now()
    logger.info(
      {
        chapterCount: chapters.length,
        timeoutMs: aiConfig.timeout ?? AI.DEFAULT_TIMEOUT,
        maxRetries: aiConfig.maxRetries ?? AI.DEFAULT_MAX_RETRIES,
      },
      '[ChapterValidation] Quality judge request started'
    )
    const result = await this.aiService.chatJson<ChapterQualityJudgeResponse>(aiConfig, params)
    const parsedScores = this.parseChapterScores(result.chapterScores)
    const failedChapterIndexes = parsedScores.filter((item) => !item.passed).map((item) => item.chapterIndex)
    const passedByScores = failedChapterIndexes.length === 0
    const passedByTopLevel = typeof result.passed === 'boolean' ? result.passed : passedByScores
    logger.info(
      {
        chapterCount: chapters.length,
        failedChapterIndexes,
        passedByTopLevel,
        elapsedMs: Date.now() - startedAt,
      },
      '[ChapterValidation] Quality judge request completed'
    )

    return {
      passed: passedByTopLevel && passedByScores,
      failedChapterIndexes,
      chapterScores: parsedScores,
    }
  }

  private parseChapterScores(raw: unknown): ChapterQualityScore[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('Chapter quality judge returned empty scores')
    }

    return raw.map((item, index) => {
      const payload = item as Record<string, unknown>
      const chapterIndex = this.toNumber(payload.chapterIndex, index)
      const cleanliness = this.clampScore(this.toNumber(payload.cleanliness, 0))
      const semanticPreservation = this.clampScore(this.toNumber(payload.semanticPreservation, 0))
      const coherenceAfterMerge = this.clampScore(this.toNumber(payload.coherenceAfterMerge, 0))
      const total = this.clampScore(
        this.toNumber(payload.total, Math.round((cleanliness + semanticPreservation + coherenceAfterMerge) / 3))
      )
      const reasons = Array.isArray(payload.reasons)
        ? payload.reasons
            .map((reason) => String(reason).trim())
            .filter(Boolean)
            .slice(0, 8)
        : []
      const passed =
        typeof payload.passed === 'boolean'
          ? payload.passed
          : total >= REVIEW_MIN_TOTAL_SCORE && reasons.length === 0

      return {
        chapterIndex,
        cleanliness,
        semanticPreservation,
        coherenceAfterMerge,
        total,
        passed,
        reasons,
      }
    })
  }

  private clampScore(score: number): number {
    if (Number.isNaN(score)) {
      return 0
    }
    return Math.min(100, Math.max(0, Math.round(score)))
  }

  private toNumber(value: unknown, fallback: number): number {
    const normalized = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(normalized) ? normalized : fallback
  }

  private mergeShortChapters(chapters: ChapterContentInput[]): {
    chapters: ChapterContentInput[]
    mergedCount: number
  } {
    const sorted = [...chapters]
      .sort((a, b) => a.chapterIndex - b.chapterIndex)
      .map((chapter, index) => ({ ...chapter, chapterIndex: index }))
    const merged: ChapterContentInput[] = []
    let mergedCount = 0
    let consecutiveMerges = 0

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (
        next &&
        this.isShortChapter(current) &&
        !this.looksStandaloneChapter(current.title) &&
        consecutiveMerges < MAX_CONSECUTIVE_SHORT_MERGES
      ) {
        const mergedNext = {
          ...next,
          content: `${current.content.trim()}\n\n${next.content.trim()}`.trim(),
        }
        sorted[i + 1] = mergedNext
        mergedCount++
        consecutiveMerges++
        continue
      }

      if (!next && merged.length > 0 && this.isShortChapter(current) && !this.looksStandaloneChapter(current.title)) {
        const previous = merged[merged.length - 1]
        merged[merged.length - 1] = {
          ...previous,
          content: `${previous.content.trim()}\n\n${current.content.trim()}`.trim(),
        }
        mergedCount++
        continue
      }

      merged.push(current)
      consecutiveMerges = 0
    }

    return {
      chapters: merged.map((chapter, index) => ({ ...chapter, chapterIndex: index })),
      mergedCount,
    }
  }

  private isShortChapter(chapter: ChapterContentInput): boolean {
    const words = chapter.content.split(/\s+/).filter(Boolean).length
    return words < SHORT_CHAPTER_WORD_THRESHOLD || chapter.content.length < SHORT_CHAPTER_CHAR_THRESHOLD
  }

  private looksStandaloneChapter(title: string): boolean {
    const normalized = title.trim().toLowerCase()
    if (!normalized) {
      return false
    }

    if (/^(chapter|ch\.?)\s+([0-9]+|[ivxlcdm]+)\b/.test(normalized)) {
      return true
    }

    if (/^第.{1,8}章/.test(title.trim())) {
      return true
    }

    return false
  }

  private collectSoftIssues(content: string): string[] {
    const issues: string[] = []

    if (!content.includes('\n\n') && content.length > 300) {
      issues.push('paragraph_structure_missing')
    }

    if (/id=("|')pgepubid/i.test(content) || /pgepubid\d+/i.test(content)) {
      issues.push('epub_id_residue')
    }

    if (this.hasHtmlResidue(content)) {
      issues.push('html_residue')
    }

    if (this.hasMarkdownResidue(content)) {
      issues.push('markdown_residue')
    }

    return issues
  }

  private validateHardConstraints(content: string): string[] {
    const errors: string[] = []

    if (this.hasHtmlResidue(content)) {
      errors.push('contains_html')
    }

    if (this.hasMarkdownResidue(content)) {
      errors.push('contains_markdown')
    }

    if (/pgepubid\d+/i.test(content) || /id=("|')pgepubid/i.test(content)) {
      errors.push('contains_epub_id_residue')
    }

    if (!content.trim()) {
      errors.push('empty_body')
    }

    return errors
  }

  private extractBody(content: string): string {
    return content.trim()
  }

  private normalizeChapter(chapter: ChapterContentInput, stats: ChapterValidationStats) {
    const title = this.normalizeTitle(chapter.title)
    let normalized = this.normalizeNewlines(chapter.content)

    if (/pgepubid\d+/i.test(normalized) || /id=("|')pgepubid/i.test(normalized)) {
      stats.ruleHits.pgepubid++
      normalized = normalized.replace(/id=("|')pgepubid[^"']*("|')>?/gi, '')
      normalized = normalized.replace(/pgepubid\d+/gi, '')
    }

    if (this.hasHtmlResidue(normalized)) {
      stats.ruleHits.htmlTag++
      normalized = normalized.replace(/<[^>]+>/g, ' ')
      normalized = normalized.replace(/<\/?[a-z][^>\n]*(?=\n|$)/gi, ' ')
    }

    normalized = this.stripMarkdownSyntax(normalized)

    normalized = normalized
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0)
        if (code === 9 || code === 10) {
          return true
        }
        return code >= 32 && code !== 127
      })
      .join('')
      .replace(/[ \t]+/g, ' ')

    const lines = normalized.split('\n').map((line) => line.trim())
    const firstLine = lines.find((line) => line.length > 0) || ''
    const bodyLines = [...lines]

    let heading = title
    if (/^#\s+/.test(firstLine)) {
      heading = firstLine.replace(/^#\s+/, '').trim() || title
      bodyLines.splice(bodyLines.indexOf(firstLine), 1)
    }

    this.stripLeadingHeadingBlock(bodyLines, heading, stats)

    const normalizedBodyLines = bodyLines.map((line) => {
      if (/^#{2,}\s+/.test(line)) {
        stats.ruleHits.subheading++
        return line.replace(/^#{2,}\s+/, '')
      }

      if (/^[-*+]\s+/.test(line)) {
        return line.replace(/^[-*+]\s+/, '')
      }

      if (/^\d+\.\s+/.test(line)) {
        return line.replace(/^\d+\.\s+/, '')
      }

      return line
    })

    let body = normalizedBodyLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    body = this.normalizeParagraphStructure(body)

    return {
      chapterIndex: chapter.chapterIndex,
      title: heading,
      content: body,
    }
  }

  private shouldKeepChapter(chapter: ChapterContentInput, stats: ChapterValidationStats): boolean {
    const nonReadingKeyword = this.contentGuardService.checkNonReadingSection(
      `# ${chapter.title}\n\n${chapter.content}`
    )
    if (nonReadingKeyword) {
      stats.ruleHits.nonReading++
      return false
    }

    if (chapter.content.length < 50) {
      return false
    }

    return true
  }

  private async repairChapterWithAi(
    chapter: ChapterContentInput,
    errors: string[]
  ): Promise<string> {
    const body = this.extractBody(chapter.content)
    if (chapter.content.length > AI_CHAPTER_MAX_CHARS && body.length > AI_CHUNK_MAX_CHARS) {
      const chunks = this.splitBodyIntoChunks(body, AI_CHUNK_MAX_CHARS)
      const repairedBodies: string[] = []

      for (const chunk of chunks) {
        const repairedChunk = await this.repairSingleChapterWithAi(
          { ...chapter, content: chunk },
          errors
        )
        repairedBodies.push(this.normalizeParagraphStructure(repairedChunk || chunk))
      }

      return repairedBodies.join('\n\n').trim()
    }

    return this.repairSingleChapterWithAi(chapter, errors)
  }

  private async repairSingleChapterWithAi(
    chapter: ChapterContentInput,
    errors: string[]
  ): Promise<string> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/chapter-content-repair', {
      title: chapter.title,
      content: chapter.content,
      errors,
    })

    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: BOOK_IMPORT_AI.REPAIR_MAX_TOKENS,
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    }

    let repairedContent = ''
    const startedAt = Date.now()
    logger.info(
      {
        chapterIndex: chapter.chapterIndex,
        contentChars: chapter.content.length,
        errorCount: errors.length,
        timeoutMs: aiConfig.timeout ?? AI.DEFAULT_TIMEOUT,
      },
      '[ChapterValidation] Chapter repair request started'
    )
    try {
      const result = await this.aiService.chatJson<ChapterRepairResponse>(aiConfig, params)
      repairedContent = result.content?.trim() || ''
    } catch {
      const raw = await this.aiService.chat(aiConfig, {
        ...params,
        responseFormat: undefined,
      })
      repairedContent = this.extractContentFromRawAiResponse(raw)
    }
    logger.info(
      {
        chapterIndex: chapter.chapterIndex,
        repairedChars: repairedContent.length,
        elapsedMs: Date.now() - startedAt,
      },
      '[ChapterValidation] Chapter repair request completed'
    )

    if (!repairedContent) {
      return chapter.content
    }

    return repairedContent
  }

  private async resolveAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: BOOK_IMPORT_AI.VALIDATION_TIMEOUT_MS,
      maxRetries: BOOK_IMPORT_AI.VALIDATION_MAX_RETRIES,
    }
  }

  private buildJudgeContentWindow(content: string): string {
    const normalized = content.trim()
    const head = normalized.slice(0, BOOK_IMPORT_AI.JUDGE_WINDOW_HEAD_CHARS)
    const tail = normalized.slice(
      Math.max(0, normalized.length - BOOK_IMPORT_AI.JUDGE_WINDOW_TAIL_CHARS)
    )

    if (!tail || normalized.length <= BOOK_IMPORT_AI.JUDGE_WINDOW_HEAD_CHARS) {
      return head
    }

    return `${head}\n\n...[TRUNCATED FOR JUDGE]...\n\n${tail}`
  }

  private normalizeTitle(title: string): string {
    const trimmed = title.trim()
    return trimmed.length > 0 ? trimmed : 'Untitled Chapter'
  }

  private normalizeNewlines(input: string): string {
    return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  }

  private normalizeParagraphStructure(body: string): string {
    if (!body) {
      return body
    }

    // Collapse hard line-wraps inside paragraphs, while keeping explicit paragraph breaks.
    const lineBreakToken = '__ELYND_LINE_BREAK__'
    let normalized = this.protectVerseLineBreaks(body, lineBreakToken).replace(
      /([^\n])\n([^\n])/g,
      '$1 $2'
    )
    normalized = normalized.replace(/[ \t]+/g, ' ').trim()
    normalized = normalized.split(lineBreakToken).join('\n')

    if (normalized.includes('\n\n') || normalized.length <= 300) {
      return normalized
    }

    // If still fully flattened long text, split by sentence groups to enforce readable paragraphs.
    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (sentences.length >= 2) {
      const chunks: string[] = []
      for (let i = 0; i < sentences.length; i += 4) {
        chunks.push(sentences.slice(i, i + 4).join(' '))
      }
      const bySentence = chunks.join('\n\n').trim()
      if (bySentence.includes('\n\n')) {
        return bySentence
      }
    }

    // Fallback: paragraphize by word count to guarantee readable blocks.
    const words = normalized.split(/\s+/).filter(Boolean)
    if (words.length <= 120) {
      return normalized
    }

    const wordChunks: string[] = []
    for (let i = 0; i < words.length; i += 90) {
      wordChunks.push(words.slice(i, i + 90).join(' '))
    }

    return wordChunks.join('\n\n').trim()
  }

  /**
   * Preserve line breaks for verse-like short line blocks (e.g. poems in classic novels).
   */
  private protectVerseLineBreaks(body: string, lineBreakToken: string): string {
    const lines = body.split('\n')
    if (lines.length < 3) {
      return body
    }

    const shortLineIndexes = new Set<number>()
    const isShortTextLine = (line: string) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && trimmed.length <= 70
    }

    for (let i = 0; i < lines.length; i++) {
      if (!isShortTextLine(lines[i])) {
        continue
      }

      let j = i
      while (j + 1 < lines.length && isShortTextLine(lines[j + 1])) {
        j++
      }

      if (j - i + 1 >= 3) {
        for (let k = i; k <= j; k++) {
          shortLineIndexes.add(k)
        }
      }
      i = j
    }

    if (shortLineIndexes.size === 0) {
      return body
    }

    let result = lines[0] || ''
    for (let i = 1; i < lines.length; i++) {
      const prevTrimmed = lines[i - 1]?.trim() || ''
      const currentTrimmed = lines[i]?.trim() || ''
      const shouldPreserve =
        prevTrimmed && currentTrimmed && shortLineIndexes.has(i - 1) && shortLineIndexes.has(i)

      result += shouldPreserve ? lineBreakToken : '\n'
      result += lines[i]
    }

    return result
  }

  private splitBodyIntoChunks(body: string, maxChars: number): string[] {
    const paragraphs = body
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (paragraphs.length === 0) {
      return [body]
    }

    const chunks: string[] = []
    let current = ''

    for (const paragraph of paragraphs) {
      const next = current ? `${current}\n\n${paragraph}` : paragraph
      if (next.length <= maxChars) {
        current = next
        continue
      }

      if (current) {
        chunks.push(current)
        current = ''
      }

      if (paragraph.length <= maxChars) {
        current = paragraph
        continue
      }

      const words = paragraph.split(/\s+/).filter(Boolean)
      let wordChunk: string[] = []
      for (const word of words) {
        const candidate = [...wordChunk, word].join(' ')
        if (candidate.length > maxChars && wordChunk.length > 0) {
          chunks.push(wordChunk.join(' '))
          wordChunk = [word]
        } else {
          wordChunk.push(word)
        }
      }
      if (wordChunk.length > 0) {
        chunks.push(wordChunk.join(' '))
      }
    }

    if (current) {
      chunks.push(current)
    }

    return chunks.length > 0 ? chunks : [body]
  }

  private extractContentFromRawAiResponse(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) {
      return ''
    }

    const fencedJson = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim()
    if (fencedJson) {
      try {
        const parsed = JSON.parse(fencedJson) as ChapterRepairResponse
        if (parsed.content?.trim()) {
          return parsed.content.trim()
        }
      } catch {
        // ignore
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as ChapterRepairResponse
        if (parsed.content?.trim()) {
          return parsed.content.trim()
        }
      } catch {
        // ignore
      }
    }

    const fencedMarkdown = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim()
    if (fencedMarkdown) {
      return fencedMarkdown
    }

    return trimmed
  }

  private stripMarkdownSyntax(content: string): string {
    return content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[#*_`~\-]+$/gm, '')
      .trim()
  }

  private hasHtmlResidue(content: string): boolean {
    return /<[^>]+>/.test(content) || /<\/?[a-z][^>\n]*(?=\n|$)/i.test(content)
  }

  private stripLeadingHeadingBlock(
    bodyLines: string[],
    heading: string,
    stats: ChapterValidationStats
  ): void {
    const normalizedHeading = this.normalizeTitleForCompare(heading)
    if (!normalizedHeading) {
      return
    }

    let changed = true
    while (changed && bodyLines.length > 0) {
      changed = false
      while (bodyLines.length > 0 && bodyLines[0] === '') {
        bodyLines.shift()
      }
      if (bodyLines.length === 0) {
        break
      }

      const first = bodyLines[0]
      if (first && this.isSameTitle(first, heading)) {
        stats.ruleHits.duplicateTitle++
        bodyLines.shift()
        changed = true
        continue
      }

      let secondIndex = -1
      for (let i = 1; i < bodyLines.length; i++) {
        if (bodyLines[i]) {
          secondIndex = i
          break
        }
      }
      if (secondIndex < 0) {
        break
      }

      const second = bodyLines[secondIndex]
      if (!second) {
        break
      }

      const combined = `${first} ${second}`.trim()
      if (
        this.normalizeTitleForCompare(combined) === normalizedHeading ||
        this.matchesSplitHeading(first, second, normalizedHeading)
      ) {
        stats.ruleHits.duplicateTitle++
        bodyLines.splice(secondIndex, 1)
        bodyLines.shift()
        changed = true
      }
    }
  }

  private matchesSplitHeading(
    firstLine: string,
    secondLine: string,
    normalizedHeading: string
  ): boolean {
    const prefixMatch = firstLine.match(/^chapter\s+([0-9ivxlcdm]+)\b[.\-:]*$/i)
    if (!prefixMatch) {
      return false
    }

    const chapterToken = prefixMatch[1]?.toLowerCase() || ''
    const normalizedSecond = this.normalizeTitleForCompare(secondLine)
    if (!normalizedSecond) {
      return false
    }

    return (
      normalizedHeading.startsWith(`chapter ${chapterToken}`) &&
      normalizedHeading.includes(normalizedSecond)
    )
  }

  private normalizeTitleForCompare(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private hasMarkdownResidue(content: string): boolean {
    return (
      /^\s{0,3}#{1,6}\s+/m.test(content) ||
      /```/.test(content) ||
      /^\s*[-*+]\s+/m.test(content) ||
      /^\s*\d+\.\s+/m.test(content) ||
      /!\[[^\]]*\]\([^)]+\)/.test(content) ||
      /\[[^\]]+\]\([^)]+\)/.test(content)
    )
  }

  private isSameTitle(line: string, title: string): boolean {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return normalize(line) === normalize(title)
  }
}
