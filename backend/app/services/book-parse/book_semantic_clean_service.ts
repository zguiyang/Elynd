import { inject } from '@adonisjs/core'
import { AI } from '#constants'
import { AiService } from '#services/ai/ai_service'
import type { AiChatParams, AiClientConfig } from '#types/ai'
import { BookChapterCleanerService } from '#services/book-parse/book_chapter_cleaner_service'
import type { ChapterOutput } from '#services/book-parse/book_chapter_cleaner_service'
import PromptService from '#services/ai/prompt_service'
import { ConfigService } from '#services/ai/config_service'

export interface SemanticMetadataInput {
  fileName: string
  sourceType: string
  chapterTitles: string[]
  sampleText: string
}

export interface SemanticMetadataOutput {
  title: string
  author: string | null
  description: string | null
}

export interface SemanticChapterInput {
  title: string
  content: string
}

export interface SemanticChapterOutput extends ChapterOutput {
  chapterIndex: number
}

interface BookLevelCandidate {
  id: number
  code: string
  description: string
  minWords: number | null
  maxWords: number | null
  sortOrder: number
}

interface BookLevelResponse {
  levelId?: number
  reason?: string
}

interface MetadataResponse {
  title?: string
  author?: string | null
  description?: string | null
}

interface ChapterResponse {
  cleanedChapters?: Array<{
    title?: string
    content?: string
    dropReason?: string | null
  }>
  droppedChapters?: Array<{
    title?: string
    reason?: string
  }>
}

@inject()
export class BookSemanticCleanService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private ruleCleaner: BookChapterCleanerService,
    private configService: ConfigService
  ) {}

  private async resolveAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    }
  }

  async extractMetadata(input: SemanticMetadataInput): Promise<SemanticMetadataOutput> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/semantic-metadata', input)
    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 4000,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    }

    const result = await this.aiService.chatJson<MetadataResponse>(aiConfig, params)

    return {
      title: (result.title || input.fileName || 'Untitled').trim(),
      author: result.author?.trim() || null,
      description: result.description?.trim() || null,
    }
  }

  async cleanChapters(chapters: SemanticChapterInput[]): Promise<SemanticChapterOutput[]> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/semantic-chapters', { chapters })
    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 16000,
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
    }

    try {
      const result = await this.aiService.chatJson<ChapterResponse>(aiConfig, params)
      const cleaned = (result.cleanedChapters || [])
        .map((chapter, index) => {
          const title = chapter.title?.trim() || `Chapter ${index + 1}`
          const content = this.toPlainBody(chapter.content || '', title)

          return {
            title,
            content,
            chapterIndex: index,
          }
        })
        .filter((chapter) => chapter.content.length > 0)

      if (cleaned.length > 0) {
        return cleaned
      }
    } catch {
      // fallback below
    }

    const fallback = this.ruleCleaner.clean(chapters)
    return fallback.cleanedChapters.map((chapter, index) => ({
      title: chapter.title,
      content: chapter.content.trim(),
      chapterIndex: index,
    }))
  }

  async classifyBookLevel(input: {
    wordCount: number
    uniqueLemmaCount: number
    sampleText: string
    candidates: BookLevelCandidate[]
  }): Promise<{ levelId: number; reason: string }> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/level-classification', input)
    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1000,
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    }

    const result = await this.aiService.chatJson<BookLevelResponse>(aiConfig, params)
    const candidateIds = new Set(input.candidates.map((item) => item.id))
    if (!result.levelId || !candidateIds.has(result.levelId)) {
      throw new Error('AI returned invalid level id')
    }

    return {
      levelId: result.levelId,
      reason: result.reason?.trim() || 'Selected by AI classifier',
    }
  }

  private toPlainBody(rawContent: string, title: string): string {
    let content = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    if (!content) {
      return ''
    }

    if (/^#\s+/.test(content)) {
      content = content.replace(/^#\s+.+$/m, '').trim()
    }

    const firstLine =
      content
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim() || ''
    if (this.isSameTitle(firstLine, title)) {
      content = content.split('\n').slice(1).join('\n').trim()
    }

    return content
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
