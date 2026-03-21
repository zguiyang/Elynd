import { inject } from '@adonisjs/core'
import { AI, BOOK_IMPORT_AI } from '#constants'
import logger from '@adonisjs/core/services/logger'
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

  private async resolveSemanticMetadataAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: BOOK_IMPORT_AI.SEMANTIC_METADATA_TIMEOUT_MS,
      maxRetries: BOOK_IMPORT_AI.SEMANTIC_METADATA_MAX_RETRIES,
    }
  }

  private async resolveSemanticChaptersAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: BOOK_IMPORT_AI.SEMANTIC_CHAPTERS_TIMEOUT_MS,
      maxRetries: BOOK_IMPORT_AI.SEMANTIC_CHAPTERS_MAX_RETRIES,
    }
  }

  private async resolveClassificationAiConfig(): Promise<AiClientConfig> {
    const config = await this.configService.getAiConfig()
    return {
      ...config,
      timeout: AI.DEFAULT_TIMEOUT,
      maxRetries: AI.DEFAULT_MAX_RETRIES,
    }
  }

  async extractMetadata(input: SemanticMetadataInput): Promise<SemanticMetadataOutput> {
    const aiConfig = await this.resolveSemanticMetadataAiConfig()
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

    try {
      const result = await this.aiService.chatJson<MetadataResponse>(aiConfig, params)

      return {
        title: (result.title || input.fileName || 'Untitled').trim(),
        author: result.author?.trim() || null,
        description: result.description?.trim() || null,
      }
    } catch (error) {
      logger.warn(
        {
          err: error,
          fileName: input.fileName,
        },
        'Semantic metadata extraction failed, fallback to source metadata'
      )

      const fallbackTitle = input.fileName.replace(/\.[^.]+$/, '').trim() || 'Untitled'
      return {
        title: fallbackTitle,
        author: null,
        description: null,
      }
    }
  }

  async cleanChapters(chapters: SemanticChapterInput[]): Promise<SemanticChapterOutput[]> {
    const aiConfig = await this.resolveSemanticChaptersAiConfig()
    const systemPrompt = this.promptService.render('system', {})
    const normalizedInput = chapters.map((chapter, index) => ({
      ...chapter,
      chapterIndex: index,
    }))

    try {
      const merged = await this.aiService.chatJsonChunked<
        SemanticChapterInput & { chapterIndex: number },
        ChapterResponse,
        SemanticChapterOutput[]
      >(aiConfig, {
        items: normalizedInput,
        maxChunkChars: BOOK_IMPORT_AI.SEMANTIC_CHAPTERS_MAX_CHUNK_INPUT_CHARS,
        maxChunkItems: BOOK_IMPORT_AI.SEMANTIC_CHAPTERS_MAX_CHUNK_ITEMS,
        getItemChars: (item) => item.title.length + item.content.length + 32,
        buildParams: ({ chunkItems }) => {
          const userPrompt = this.promptService.render('book/semantic-chapters', {
            chapters: chunkItems.map((item) => ({
              title: item.title,
              content: item.content,
            })),
          })
          return {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            maxTokens: 3500,
            temperature: 0.2,
            responseFormat: { type: 'json_object' },
          }
        },
        onChunkError: async ({ chunkItems, error }) => {
          logger.warn(
            {
              err: error,
              chunkChapterCount: chunkItems.length,
            },
            'Semantic chapter clean chunk failed, fallback to rule cleaner for this chunk'
          )
          const fallback = this.ruleCleaner.clean(
            chunkItems.map((item) => ({ title: item.title, content: item.content }))
          )
          return {
            cleanedChapters: fallback.cleanedChapters.map((chapter) => ({
              title: chapter.title,
              content: chapter.content.trim(),
              dropReason: null,
            })),
            droppedChapters: [],
          }
        },
        mergeResults: (results) =>
          results
            .flatMap(({ context, result }) => {
              return (result.cleanedChapters || [])
                .map((chapter, index) => {
                  const source = context.chunkItems[index]
                  const title = chapter.title?.trim() || source?.title || `Chapter ${index + 1}`
                  const content = this.toPlainBody(chapter.content || '', title)
                  return {
                    title,
                    content,
                    chapterIndex: source?.chapterIndex ?? index,
                  }
                })
                .filter((chapter) => chapter.content.length > 0)
            })
            .sort((a, b) => a.chapterIndex - b.chapterIndex)
            .map((chapter, index) => ({ ...chapter, chapterIndex: index })),
        logLabel: 'semantic-chapters',
      })

      if (merged.length > 0) {
        return merged
      }
    } catch (error) {
      logger.warn({ err: error }, 'Semantic chapter clean failed, fallback to full rule cleaner')
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
    const aiConfig = await this.resolveClassificationAiConfig()
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
