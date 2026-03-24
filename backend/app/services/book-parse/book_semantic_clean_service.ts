import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { AiService } from '#services/ai/ai_service'
import type { AiChatParams, AiClientConfig } from '#types/ai'
import { BookChapterCleanerService } from '#services/book-parse/book_chapter_cleaner_service'
import type { ChapterOutput } from '#services/book-parse/book_chapter_cleaner_service'
import { BookContentGuardService } from '#services/book-parse/book_content_guard_service'
import {
  buildCanonicalChapterText,
  extractCanonicalChapterParts,
} from '#utils/book_text_normalizer'
import PromptService from '#services/ai/prompt_service'
import { ConfigService } from '#services/ai/config_service'
import {
  BookChapterQualityClassifierService,
  CHAPTER_QUALITY_DECISIONS,
} from '#services/book-parse/book_chapter_quality_classifier_service'

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

@inject()
export class BookSemanticCleanService {
  constructor(
    private aiService: AiService,
    private promptService: PromptService,
    private ruleCleaner: BookChapterCleanerService,
    private contentGuard: BookContentGuardService,
    private configService: ConfigService,
    private chapterQualityClassifier?: BookChapterQualityClassifierService
  ) {}

  private async resolveAiConfig(): Promise<AiClientConfig> {
    return this.configService.getAiConfig()
  }

  async extractMetadata(input: SemanticMetadataInput): Promise<SemanticMetadataOutput> {
    const aiConfig = await this.resolveAiConfig()
    const systemPrompt = this.promptService.render('book/import/system', {})
    const userPrompt = this.promptService.render('book/import/semantic-metadata', input)
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
    const normalizedInput = chapters.map((chapter, index) => ({
      ...chapter,
      chapterIndex: index,
    }))
    const fallback = this.ruleCleaner.clean(normalizedInput)
    const cleanedChapters: SemanticChapterOutput[] = []

    for (let index = 0; index < fallback.cleanedChapters.length; index++) {
      const chapter = fallback.cleanedChapters[index]
      const review = this.chapterQualityClassifier
        ? await this.chapterQualityClassifier.reviewChapter({
            chapterIndex: chapter.chapterIndex,
            title: chapter.title,
            content: chapter.content,
            previousTitle: fallback.cleanedChapters[index - 1]?.title || null,
            nextTitle: fallback.cleanedChapters[index + 1]?.title || null,
          })
        : {
            decision: CHAPTER_QUALITY_DECISIONS.KEEP,
            confidence: 1,
            reason: 'classifier_unavailable',
            signals: [],
            reviewedByAi: false,
          }

      if (review.decision !== CHAPTER_QUALITY_DECISIONS.KEEP) {
        logger.info(
          {
            chapterTitle: chapter.title,
            chapterIndex: chapter.chapterIndex,
            decision: review.decision,
            confidence: review.confidence,
            reason: review.reason,
            signals: review.signals,
          },
          'AI chapter classifier dropped chapter'
        )
        continue
      }

      const canonical = extractCanonicalChapterParts({
        title: chapter.title,
        content: chapter.content,
      })
      if (canonical.droppedPrefix) {
        logger.info(
          {
            chapterTitle: chapter.title,
            chapterIndex: chapter.chapterIndex,
            canonicalTitle: canonical.title,
          },
          'Canonical chapter trimmed non-reading prefix'
        )
      }
      if (!canonical.content) {
        logger.info(
          {
            chapterTitle: chapter.title,
            chapterIndex: chapter.chapterIndex,
            decision: review.decision,
          },
          'Canonical chapter was empty after trimming non-reading prefix'
        )
        continue
      }

      const contentWithTitle = buildCanonicalChapterText(canonical.title, canonical.content)
      const validation = this.contentGuard.validate(contentWithTitle)
      if (!validation.valid) {
        logger.warn(
          {
            chapterTitle: canonical.title,
            chapterIndex: chapter.chapterIndex,
            errors: validation.errors,
          },
          'Rule-based semantic clean rejected chapter'
        )
        continue
      }

      cleanedChapters.push({
        title: canonical.title,
        content: canonical.content,
        chapterIndex: chapter.chapterIndex,
      })
    }

    if (cleanedChapters.length === 0) {
      throw new Error('No readable chapters after semantic cleaning')
    }

    return cleanedChapters.map((chapter, index) => ({ ...chapter, chapterIndex: index }))
  }
}
