/**
 * Content Guard Service
 *
 * Validates book chapter content before persistence to ensure
 * only valid reading content is stored.
 */

import { inject } from '@adonisjs/core'
import { hasHtmlResidue } from '#services/book-parse/book_text_normalizer'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Non-reading section keywords that should be rejected
 */
const NON_READING_SECTION_KEYWORDS = [
  'license',
  'copyright',
  'toc',
  'table of contents',
  'preface',
  'foreword',
  'acknowledgements',
  'acknowledgments',
  'dedication',
  'introduction',
  'prologue',
  'epilogue',
  'notes',
  'references',
  'bibliography',
  'index',
  'glossary',
  'appendix',
  'about the author',
  'about the publisher',
  'title page',
  'publisher',
  'cover',
  'disclaimer',
  'contents',
  'advertisement',
  'advertisements',
]

/**
 * Chapter markers that indicate potential merged chapters
 */
const CHAPTER_MARKERS = [
  /(^|\n)\s*chapter\s+(?:\d+|[ivxlcdm]+)\b/gim,
  /(^|\n)\s*第.+章\b/gmu,
  /(^|\n)\s*ch\.\s*\d+\b/gim,
]

@inject()
export class BookContentGuardService {
  /**
   * Validate chapter content and return validation result
   */
  validate(content: string): ValidationResult {
    const errors: string[] = []

    // Run all validation checks
    if (!this.hasReadableTitleLine(content)) {
      errors.push('First line must contain a readable title')
    }

    if (this.hasSubheadings(content)) {
      errors.push('Content contains subheadings (## or ###)')
    }

    if (hasHtmlResidue(content)) {
      errors.push('Content contains HTML residue')
    }

    const nonReadingResult = this.checkNonReadingSection(content)
    if (nonReadingResult) {
      errors.push(`Non-reading section detected: ${nonReadingResult}`)
    }

    if (this.hasBrokenParagraphs(content)) {
      errors.push('Content has broken paragraph structure (single lines or no readable paragraphs)')
    }

    if (this.hasMergedChapters(content)) {
      errors.push('Content appears to contain merged chapters with multiple chapter markers')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate that the first line of content is a readable title
   */
  hasReadableTitleLine(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false
    }

    const firstLine = content.split('\n')[0].trim()
    return firstLine.length > 0
  }

  /**
   * Check if content contains subheadings (##, ###, etc.)
   */
  hasSubheadings(content: string): boolean {
    const lines = this.getBodyLines(content)
    for (const line of lines) {
      const trimmed = line.trim()
      // Check for markdown subheadings (##, ###, ####, etc.)
      if (/^#{2,}\s+\S/.test(trimmed)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if content appears to be a non-reading section
   * Returns the detected keyword if found, otherwise null
   */
  checkNonReadingSection(content: string): string | null {
    const normalized = content.toLowerCase()
    const heading = content
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.replace(/^#\s+/, '')
      .trim()
      .toLowerCase()

    for (const keyword of NON_READING_SECTION_KEYWORDS) {
      if (heading?.includes(keyword)) {
        return keyword
      }
    }

    if (normalized.includes('project gutenberg') && normalized.includes('license')) {
      return 'project gutenberg license'
    }

    return null
  }

  /**
   * Check if content has broken paragraph structure:
   * - Single line content
   * - No readable paragraphs (less than 3 lines of substantial content)
   */
  hasBrokenParagraphs(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return true
    }

    const body = this.getBody(content)
    if (!body) {
      return true
    }

    const paragraphs = body
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (paragraphs.length === 0) {
      return true
    }

    // Reject fully flattened text when body is long and no paragraph separators exist.
    if (!body.includes('\n\n') && body.length > 300) {
      return true
    }

    return false
  }

  /**
   * Check if content appears to contain merged chapters
   * (multiple chapter markers in the content)
   */
  hasMergedChapters(content: string): boolean {
    const body = this.getBody(content)
    let markerCount = 0
    for (const marker of CHAPTER_MARKERS) {
      markerCount += (body.match(marker) || []).length
    }

    return markerCount > 1
  }

  /**
   * Reject subheadings - wrapper for hasSubheadings
   * Returns true if subheadings should cause rejection
   */
  rejectSubheadings(content: string): boolean {
    return this.hasSubheadings(content)
  }

  /**
   * Reject non-reading sections - wrapper for checkNonReadingSection
   * Returns true if non-reading section should cause rejection
   */
  rejectNonReadingSections(content: string): boolean {
    return this.checkNonReadingSection(content) !== null
  }

  /**
   * Reject broken paragraphs - wrapper for hasBrokenParagraphs
   * Returns true if broken paragraphs should cause rejection
   */
  rejectBrokenParagraphs(content: string): boolean {
    return this.hasBrokenParagraphs(content)
  }

  /**
   * Reject merged chapters - wrapper for hasMergedChapters
   * Returns true if merged chapters should cause rejection
   */
  rejectMergedChapters(content: string): boolean {
    return this.hasMergedChapters(content)
  }

  private getBody(content: string): string {
    return content.split(/\n\s*\n/).slice(1).join('\n\n').trim()
  }

  private getBodyLines(content: string): string[] {
    return this.getBody(content).split('\n')
  }
}
