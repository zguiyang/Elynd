import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { parseEpub } from '@gxl/epub-parser'

export interface ParsedBookChapter {
  chapterIndex: number
  title: string
  content: string
  wordCount: number
}

export interface ParsedBookResult {
  title: string
  author: string | null
  description: string | null
  chapters: ParsedBookChapter[]
  wordCount: number
}

@inject()
export class BookParserService {
  private static readonly MAX_FILE_SIZE = 4 * 1024 * 1024
  private static readonly ALLOWED_EXTENSIONS = ['epub', 'txt']

  validateFile(file: MultipartFile) {
    const ext = (file.extname || '').toLowerCase()
    const size = file.size ?? 0

    if (!BookParserService.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Exception('Only .epub and .txt files are supported', { status: 400 })
    }

    if (size > BookParserService.MAX_FILE_SIZE) {
      throw new Exception('File size exceeds 4MB limit', { status: 400 })
    }

    if (!file.tmpPath) {
      throw new Exception('Failed to read uploaded file', { status: 400 })
    }
  }

  async parseFile(file: MultipartFile): Promise<ParsedBookResult> {
    this.validateFile(file)

    const ext = (file.extname || '').toLowerCase()
    if (ext === 'epub') {
      return this.parseEpub(file.tmpPath!)
    }
    return this.parseTxt(file.tmpPath!)
  }

  async parseEpub(path: string): Promise<ParsedBookResult> {
    const epub = await parseEpub(path, { type: 'path', expand: false })
    const structure = Array.isArray(epub.structure) ? epub.structure : []
    const sections = Array.isArray(epub.sections) ? epub.sections : []
    const sectionMap = new Map(sections.map((section) => [section.id, section]))

    const chapters = structure
      .map((node: any, index) => {
        const section = sectionMap.get(String(node.sectionId))
        const title = String(node.name || `Chapter ${index + 1}`)
        const rawContent = section?.htmlString || ''
        const content = this.cleanContent(rawContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))

        return {
          chapterIndex: index,
          title,
          content,
          wordCount: this.countWords(content),
        }
      })
      .filter((chapter) => chapter.content.length > 0)

    const fallbackContent = sections
      .map((section) => section.htmlString || '')
      .join('\n\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const normalizedChapters =
      chapters.length > 0
        ? chapters
        : [
            {
              chapterIndex: 0,
              title: epub.info?.title || 'Untitled',
              content: this.cleanContent(fallbackContent),
              wordCount: this.countWords(fallbackContent),
            },
          ]

    return {
      title: epub.info?.title || 'Untitled',
      author: epub.info?.author || null,
      description: null,
      chapters: normalizedChapters,
      wordCount: normalizedChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    }
  }

  async parseTxt(path: string): Promise<ParsedBookResult> {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(path, 'utf-8')
    const cleaned = this.cleanContent(content)
    const chapters = this.splitTxtChapters(cleaned)
    const metadata = this.extractMetadata(cleaned)

    const normalizedChapters =
      chapters.length > 0
        ? chapters
        : [
            {
              chapterIndex: 0,
              title: 'Chapter 1',
              content: cleaned,
              wordCount: this.countWords(cleaned),
            },
          ]

    return {
      title: metadata.title || 'Untitled',
      author: metadata.author,
      description: metadata.description,
      chapters: normalizedChapters,
      wordCount: normalizedChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    }
  }

  extractMetadata(content: string): {
    title: string | null
    author: string | null
    description: string | null
  } {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const title = lines[0] || null
    const authorLine = lines.find((line) => /^by\s+/i.test(line))
    const author = authorLine ? authorLine.replace(/^by\s+/i, '').trim() : null

    return { title, author, description: null }
  }

  cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\n/i, '')
      .replace(/\n[\s\S]*?END OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  private splitTxtChapters(content: string): ParsedBookChapter[] {
    const chapterRegex = /(?:^|\n)(chapter\s+(?:\d+|[ivxlcdm]+)[^\n]*)/gi
    const matches = Array.from(content.matchAll(chapterRegex))

    if (matches.length === 0) {
      return []
    }

    const chapters: ParsedBookChapter[] = []

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i]
      const start = current.index ?? 0
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length
      const block = content.slice(start, end).trim()
      const lines = block.split('\n').map((line) => line.trim())
      const title = lines[0] || `Chapter ${i + 1}`
      const chapterContent = lines.slice(1).join('\n').trim()

      chapters.push({
        chapterIndex: i,
        title,
        content: chapterContent,
        wordCount: this.countWords(chapterContent),
      })
    }

    return chapters.filter((chapter) => chapter.content.length > 0)
  }

  private countWords(content: string): number {
    const words = content.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g)
    return words?.length ?? 0
  }
}
