import { AiService } from './ai_service.js'
import type { AiClientConfig, AiChatParams } from '#types/ai'
import {
  BookChapterCleanerService,
  type ChapterInput,
  type ChapterOutput,
  type CleanResult,
} from './book_chapter_cleaner_service.js'
import { AI } from '#constants'

export interface SemanticChapterInput extends ChapterInput {}

export interface SemanticChapterOutput extends ChapterOutput {
  keep: boolean
  reason: string
}

export interface DroppedChapter {
  title: string
  content: string
  keep: boolean
  reason: string
}

export interface SemanticCleanResult {
  cleanedChapters: ChapterOutput[]
  stats: {
    droppedEmpty: number
    droppedShort: number
    droppedNoisy: number
    totalDropped: number
    totalInput: number
  }
  isFallback: boolean
}

interface SemanticCleanResponse {
  cleanedChapters: SemanticChapterOutput[]
  droppedChapters: DroppedChapter[]
}

export class BookSemanticCleanService {
  private aiConfig: AiClientConfig
  public aiService: AiService
  public promptService: { render: (name: string, data: Record<string, any>) => string }
  public ruleCleaner: BookChapterCleanerService

  constructor(
    aiService: AiService,
    promptService: { render: (name: string, data: Record<string, any>) => string },
    ruleCleaner: BookChapterCleanerService
  ) {
    this.aiService = aiService
    this.promptService = promptService
    this.ruleCleaner = ruleCleaner

    // Default AI config - can be overridden with environment variables
    this.aiConfig = {
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    }
  }

  /**
   * Clean book chapters using AI semantic analysis
   * Falls back to rule-based cleaner if AI fails
   */
  async clean(chapters: SemanticChapterInput[]): Promise<SemanticCleanResult> {
    try {
      const payload = this.buildPromptPayload(chapters)
      const result = await this.validateResult(payload)

      return this.mapToCleanResult(result, chapters.length)
    } catch (error) {
      // Fallback to rule-based cleaner
      return this.fallbackWithRuleCleaner(chapters)
    }
  }

  /**
   * Build the prompt payload for semantic cleaning
   */
  private buildPromptPayload(chapters: SemanticChapterInput[]): {
    chapters: { title: string; content: string }[]
  } {
    return {
      chapters: chapters.map((ch) => ({
        title: ch.title,
        content: ch.content,
      })),
    }
  }

  /**
   * Call AI to get semantic clean result
   */
  private async validateResult(payload: {
    chapters: { title: string; content: string }[]
  }): Promise<SemanticCleanResponse> {
    const systemPrompt = this.promptService.render('system', {})
    const userPrompt = this.promptService.render('book/semantic-clean', payload)

    const params: AiChatParams = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 16000,
      temperature: 0.3,
      responseFormat: { type: 'json_object' },
    }

    return this.aiService.chatJson<SemanticCleanResponse>(this.aiConfig, params)
  }

  /**
   * Map AI response to clean result format
   */
  private mapToCleanResult(
    aiResult: SemanticCleanResponse,
    totalInput: number
  ): SemanticCleanResult {
    const cleanedChapters: ChapterOutput[] = []
    let droppedEmpty = 0
    let droppedShort = 0
    let droppedNoisy = 0

    // Process cleaned chapters
    for (const chapter of aiResult.cleanedChapters) {
      if (chapter.keep) {
        cleanedChapters.push({
          title: chapter.title,
          content: chapter.content,
          chapterIndex: cleanedChapters.length,
        })
      }
    }

    // Process dropped chapters and categorize reasons
    for (const chapter of aiResult.droppedChapters) {
      const reason = chapter.reason.toLowerCase()
      if (reason.includes('empty') || reason.includes('blank')) {
        droppedEmpty++
      } else if (reason.includes('short')) {
        droppedShort++
      } else if (
        reason.includes('advertisement') ||
        reason.includes('boilerplate') ||
        reason.includes('copyright') ||
        reason.includes('acknowledg') ||
        reason.includes('reference') ||
        reason.includes('table of contents') ||
        reason.includes('index')
      ) {
        droppedNoisy++
      } else {
        droppedNoisy++ // Default to noisy for other reasons
      }
    }

    return {
      cleanedChapters,
      stats: {
        droppedEmpty,
        droppedShort,
        droppedNoisy,
        totalDropped: droppedEmpty + droppedShort + droppedNoisy,
        totalInput,
      },
      isFallback: false,
    }
  }

  /**
   * Fallback to rule-based cleaner when AI fails
   */
  private fallbackWithRuleCleaner(chapters: SemanticChapterInput[]): SemanticCleanResult {
    const result: CleanResult = this.ruleCleaner.clean(chapters)

    return {
      cleanedChapters: result.cleanedChapters,
      stats: result.stats,
      isFallback: true,
    }
  }
}
