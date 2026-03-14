import { inject } from '@adonisjs/core'
import { AI } from '#constants'
import { AiService } from '#services/ai_service'
import { ConfigService } from '#services/config_service'
import PromptService from '#services/prompt_service'
import { BookContentGuardService } from '#services/book_content_guard_service'
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

const AI_CHAPTER_MAX_CHARS = 9000
const AI_CHUNK_MAX_CHARS = 4500

@inject()
export class BookChapterValidationService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private configService: ConfigService,
    private contentGuardService: BookContentGuardService
  ) {}

  async validateChapters(chapters: ChapterContentInput[]): Promise<ChapterValidationResult> {
    const stats: ChapterValidationStats = {
      totalChapters: chapters.length,
      removedChapters: 0,
      fixedByRules: 0,
      fixedByAi: 0,
      ruleHits: {
        pgepubid: 0,
        htmlTag: 0,
        subheading: 0,
        duplicateTitle: 0,
        nonReading: 0,
      },
    }

    const validated: ChapterContentInput[] = []

    for (const chapter of chapters) {
      const normalized = this.normalizeChapter(chapter, stats)
      if (!this.shouldKeepChapter(normalized.content, stats)) {
        stats.removedChapters++
        continue
      }

      if (normalized.content !== chapter.content.trim()) {
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
                content: `# ${candidate.title}\n\n${recoveredBody}`,
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

    return {
      chapters: validated,
      stats,
    }
  }

  private collectSoftIssues(content: string): string[] {
    const issues: string[] = []
    const body = content.replace(/^#\s+.+$/m, '').trim()

    if (!body.includes('\n\n') && body.length > 300) {
      issues.push('paragraph_structure_missing')
    }

    if (/id=(\"|')pgepubid/i.test(content) || /pgepubid\d+/i.test(content)) {
      issues.push('epub_id_residue')
    }

    if (/<[^>]+>/.test(content)) {
      issues.push('html_residue')
    }

    if (/^#{2,}\s+\S/m.test(content)) {
      issues.push('subheading_detected')
    }

    return issues
  }

  private validateHardConstraints(content: string): string[] {
    const errors: string[] = []

    if (!this.contentGuardService.validateFirstLineIsH1(content)) {
      errors.push('first_line_not_h1')
    }

    if (this.contentGuardService.hasSubheadings(content)) {
      errors.push('contains_subheadings')
    }

    if (/<[^>]+>/.test(content)) {
      errors.push('contains_html')
    }

    if (/pgepubid\d+/i.test(content) || /id=(\"|')pgepubid/i.test(content)) {
      errors.push('contains_epub_id_residue')
    }

    const body = content.replace(/^#\s+.+$/m, '').trim()
    if (!body) {
      errors.push('empty_body')
    }

    return errors
  }

  private extractBody(content: string): string {
    return content.replace(/^#\s+.+$/m, '').trim()
  }

  private normalizeChapter(chapter: ChapterContentInput, stats: ChapterValidationStats) {
    const title = this.normalizeTitle(chapter.title)
    let normalized = this.normalizeNewlines(chapter.content)

    if (/pgepubid\d+/i.test(normalized)) {
      stats.ruleHits.pgepubid++
      normalized = normalized.replace(/id=("|')pgepubid[^"']*("|')>?/gi, '')
      normalized = normalized.replace(/pgepubid\d+/gi, '')
    }

    if (/<[^>]+>/g.test(normalized)) {
      stats.ruleHits.htmlTag++
      normalized = normalized.replace(/<[^>]+>/g, ' ')
    }

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

    while (bodyLines.length > 0 && bodyLines[0] === '') {
      bodyLines.shift()
    }

    if (bodyLines[0] && this.isSameTitle(bodyLines[0], heading)) {
      stats.ruleHits.duplicateTitle++
      bodyLines.shift()
    }

    const normalizedBodyLines = bodyLines.map((line) => {
      if (/^#{2,}\s+/.test(line)) {
        stats.ruleHits.subheading++
        return line.replace(/^#{2,}\s+/, '')
      }
      return line
    })

    let body = normalizedBodyLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    body = this.normalizeParagraphStructure(body)

    const content = body ? `# ${heading}\n\n${body}` : `# ${heading}`

    return {
      chapterIndex: chapter.chapterIndex,
      title: heading,
      content,
    }
  }

  private shouldKeepChapter(content: string, stats: ChapterValidationStats): boolean {
    const nonReadingKeyword = this.contentGuardService.checkNonReadingSection(content)
    if (nonReadingKeyword) {
      stats.ruleHits.nonReading++
      return false
    }

    const body = content.replace(/^#\s+.+$/m, '').trim()
    if (body.length < 50) {
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
        const chunkContent = `# ${chapter.title}\n\n${chunk}`
        const repairedChunk = await this.repairSingleChapterWithAi(
          { ...chapter, content: chunkContent },
          errors
        )
        const repairedBody = this.extractBody(repairedChunk)
        repairedBodies.push(this.normalizeParagraphStructure(repairedBody || chunk))
      }

      return `# ${chapter.title}\n\n${repairedBodies.join('\n\n').trim()}`
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
      maxTokens: 3500,
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    }

    let repairedContent = ''
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

    if (!repairedContent) {
      return chapter.content
    }

    return repairedContent
  }

  private async resolveAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    }
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
    let normalized = body.replace(/([^\n])\n([^\n])/g, '$1 $2')
    normalized = normalized.replace(/[ \t]+/g, ' ').trim()

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
