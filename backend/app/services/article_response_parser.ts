import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { AiArticleResponse, ParsedArticleResponse, VocabularyItem } from '#types/article'

@inject()
export class ArticleResponseParser {
  parse(raw: AiArticleResponse): ParsedArticleResponse {
    let processedData = JSON.stringify(raw)

    processedData = processedData.replace(
      /"tableOfContents"\s*:\s*\{((?:\s*"[^"]*"\s*,?)*)\}/gs,
      '"tableOfContents": [$1]'
    )
    processedData = processedData.replace(
      /"table_of_contents"\s*:\s*\{((?:\s*"[^"]*"\s*,?)*)\}/gs,
      '"table_of_contents": [$1]'
    )

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

    const normalizedToc = this.normalizeToc(parsedArticleData.tableOfContents)
    const normalizedTags = this.normalizeTags(parsedArticleData.tags)
    const normalizedVocabulary = this.normalizeVocabulary(parsedArticleData.vocabulary)

    return {
      title: parsedArticleData.title || '',
      tableOfContents: normalizedToc,
      chapterCount: parsedArticleData.chapterCount || 0,
      content: parsedArticleData.content || '',
      wordCount: parsedArticleData.wordCount || 0,
      tags: normalizedTags,
      vocabulary: normalizedVocabulary,
    }
  }

  normalizeToc(input: unknown): string[] {
    if (input === null || input === undefined) return []

    if (Array.isArray(input)) {
      const arr = input.map((v) => String(v).trim()).filter((s) => s.length > 0)
      return arr.length ? arr : []
    }

    if (typeof input === 'object') {
      try {
        const values = Object.values(input as Record<string, unknown>)
        const arr = values.map((v) => String(v).trim()).filter((s) => s.length > 0)
        return arr.length ? arr : []
      } catch {
        return []
      }
    }

    if (typeof input === 'string') {
      const raw = input.trim()
      if (!raw) return []

      if (raw.startsWith('[')) {
        try {
          const arr = JSON.parse(raw)
          if (Array.isArray(arr)) {
            const fixed = arr
              .map((v: unknown) => String(v).trim())
              .filter((s: string) => s.length > 0)
            return fixed.length ? fixed : []
          }
        } catch {}
      }

      if (raw.startsWith('{') && raw.includes('"')) {
        const fixedCandidate = raw
          .replace(/\s+/g, ' ')
          .replace(/^\{\s*((?:"[^"]*"\s*,\s*)*"[^"]*")\s*\}$/g, '[$1]')
        try {
          const arr = JSON.parse(fixedCandidate)
          if (Array.isArray(arr)) {
            const fixed = arr
              .map((v: unknown) => String(v).trim())
              .filter((s: string) => s.length > 0)
            return fixed.length ? fixed : []
          }
        } catch {}
      }

      const list = raw
        .split(/[\n,，、;；]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      return list.length ? list : []
    }

    return []
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
  tableOfContents: unknown
  chapterCount: number
  content: string
  wordCount: number
  tags: unknown
  vocabulary: unknown
}
