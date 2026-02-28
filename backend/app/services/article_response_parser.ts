import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type {
  AiArticleResponse,
  ParsedArticleResponse,
  VocabularyItem,
  ChapterItem,
} from '#types/article'

@inject()
export class ArticleResponseParser {
  parse(raw: AiArticleResponse): ParsedArticleResponse {
    let processedData = JSON.stringify(raw)

    let parsedArticleData: ParsedArticleData
    try {
      parsedArticleData = JSON.parse(processedData) as ParsedArticleData
    } catch (parseError) {
      logger.error(
        {
          parseError: (parseError as Error).message,
          rawResponse: JSON.stringify(raw).substring(0, 1000),
        },
        '[Article Response Parser] JSON parse failed'
      )
      throw new Error('AI response is not valid JSON')
    }

    const normalizedChapters = this.normalizeChapters(parsedArticleData.chapters)
    const normalizedTags = this.normalizeTags(parsedArticleData.tags)
    const normalizedVocabulary = this.normalizeVocabulary(parsedArticleData.vocabulary)

    return {
      title: parsedArticleData.title || '',
      chapters: normalizedChapters,
      wordCount: parsedArticleData.wordCount || 0,
      tags: normalizedTags,
      vocabulary: normalizedVocabulary,
    }
  }

  normalizeChapters(input: unknown): ChapterItem[] {
    if (!input || !Array.isArray(input)) return []

    return input
      .filter(
        (chapter): chapter is ChapterItemRaw =>
          chapter && typeof chapter === 'object' && typeof chapter.title === 'string'
      )
      .map((chapter, index) => ({
        index: typeof chapter.index === 'number' ? chapter.index : index,
        title: chapter.title,
        content: typeof chapter.content === 'string' ? chapter.content : '',
      }))
      .filter((chapter) => chapter.content.length > 0)
  }

  normalizeTags(input: unknown): Array<{ name: string; isNew: boolean }> {
    if (!input) return []

    if (!Array.isArray(input)) return []

    return input.filter((t) => t && typeof t === 'object' && typeof t.name === 'string')
  }

  normalizeVocabulary(input: unknown): VocabularyItem[] {
    if (!input) return []

    if (!Array.isArray(input)) return []

    return input.filter((v) => v && typeof v === 'object' && typeof v.word === 'string')
  }
}

interface ParsedArticleData {
  title: string
  chapters: unknown
  wordCount: number
  tags: unknown
  vocabulary: unknown
}

interface ChapterItemRaw {
  index?: number
  title: string
  content?: string
}
