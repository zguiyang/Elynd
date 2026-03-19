import { createHash } from 'node:crypto'
import { inject } from '@adonisjs/core'

@inject()
export class BookHashService {
  /**
   * Generate a hash for raw file content (buffer or string)
   */
  hashRawFile(content: Buffer | string): string {
    const normalized = typeof content === 'string' ? content : content.toString('utf-8')
    return this.computeHash(normalized)
  }

  /**
   * Generate a deterministic hash for normalized book chapters
   * Uses normalized content (trimmed, normalized whitespace/newlines, lowercase)
   */
  hashNormalizedBook(chapters: Array<{ title: string; content: string }>): string {
    const normalizedContent = chapters
      .map((chapter) => {
        const normalizedTitle = chapter.title.trim().toLowerCase()
        const normalizedChapterContent = this.normalizeContent(chapter.content)
        return `${normalizedTitle}:${normalizedChapterContent}`
      })
      .join('|')

    return this.computeHash(normalizedContent)
  }

  /**
   * Normalize content for hashing:
   * - Trim whitespace
   * - Normalize newlines and multiple spaces to single space
   * - Convert to lowercase for consistent hashing
   */
  private normalizeContent(content: string): string {
    return content
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  /**
   * Compute SHA-256 hash and return as hex string
   */
  private computeHash(data: string): string {
    return createHash('sha256').update(data, 'utf-8').digest('hex')
  }
}
