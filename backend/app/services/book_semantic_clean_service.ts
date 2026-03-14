import { AI } from '#constants'
import { AiService } from './ai_service.js'
import type { AiChatParams, AiClientConfig } from '#types/ai'
import { BookChapterCleanerService, type ChapterOutput } from './book_chapter_cleaner_service.js'
import { ConfigService } from '#services/config_service'

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

export class BookSemanticCleanService {
  constructor(
    private aiService: AiService,
    private promptService: { render: (name: string, data: Record<string, any>) => string },
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
          const rawContent = chapter.content?.trim() || ''
          const titleMatch = rawContent.match(/^#\s+(.+)$/m)
          const title = titleMatch
            ? titleMatch[1].trim()
            : chapter.title?.trim() || `Chapter ${index + 1}`

          const contentBody = rawContent.replace(/^#\s+.+$/m, '').trim()
          const content = contentBody ? `# ${title}\n\n${contentBody}` : `# ${title}`

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
      content: `# ${chapter.title}\n\n${chapter.content.trim()}`,
      chapterIndex: index,
    }))
  }
}
