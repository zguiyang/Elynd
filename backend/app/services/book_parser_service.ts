import { inject } from '@adonisjs/core'
import drive from '@adonisjs/drive/services/main'
import { Exception } from '@adonisjs/core/exceptions'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import EPub, { type ManifestItem } from 'epub'

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
  private static readonly EPUB_CONTENT_MEDIA_TYPES = new Set(['application/xhtml+xml', 'text/html'])

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

  async parseFileFromStorage(
    storagePath: string,
    absolutePath: string,
    extname: string
  ): Promise<ParsedBookResult> {
    const ext = extname.toLowerCase()
    if (ext === 'epub') {
      return this.parseEpub(absolutePath)
    }
    if (ext === 'txt') {
      return this.parseTxtFromStorage(storagePath)
    }
    throw new Exception('Only .epub and .txt files are supported', { status: 400 })
  }

  async parseEpub(path: string): Promise<ParsedBookResult> {
    const epub = new EPub(path)
    await epub.parse()

    const flow = Array.isArray(epub.flow) ? epub.flow : []
    const toc = Array.isArray(epub.toc) ? epub.toc : []
    const tocTitleById = new Map<string, string>()
    const tocTitleByHref = new Map<string, string>()
    const chapters: ParsedBookChapter[] = []

    for (const tocItem of toc) {
      if (tocItem.id) {
        tocTitleById.set(String(tocItem.id), String(tocItem.title || ''))
      }

      if (tocItem.href) {
        tocTitleByHref.set(this.normalizeEpubHref(tocItem.href), String(tocItem.title || ''))
      }
    }

    for (const item of flow) {
      if (!this.isEpubContentManifestItem(item)) {
        continue
      }

      const rawContent = await this.readEpubChapterRaw(epub, item.id)
      if (!rawContent) {
        continue
      }

      const content = this.cleanContent(rawContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))
      if (!content) {
        continue
      }

      const title = this.resolveEpubChapterTitle(
        item,
        tocTitleById,
        tocTitleByHref,
        chapters.length
      )

      chapters.push({
        chapterIndex: chapters.length,
        title,
        content,
        wordCount: this.countWords(content),
      })
    }

    const fallbackContent = chapters
      .map((chapter) => chapter.content)
      .join('\n\n')
      .trim()
    const metadataTitle = this.normalizeEpubMetadataField(epub.metadata?.title) || 'Untitled'
    const metadataAuthor = this.normalizeEpubMetadataField(epub.metadata?.creator)
    const metadataDescription = this.normalizeEpubMetadataField(epub.metadata?.description)

    const normalizedChapters =
      chapters.length > 0
        ? chapters
        : [
            {
              chapterIndex: 0,
              title: metadataTitle,
              content: this.cleanContent(fallbackContent),
              wordCount: this.countWords(fallbackContent),
            },
          ]

    return {
      title: metadataTitle,
      author: metadataAuthor,
      description: metadataDescription,
      chapters: normalizedChapters,
      wordCount: normalizedChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    }
  }

  async parseTxtFromStorage(storagePath: string): Promise<ParsedBookResult> {
    const contentBuffer = await drive.use().get(storagePath)
    const content = Buffer.from(contentBuffer).toString('utf-8')
    return this.parseTxtContent(content)
  }

  private parseTxtContent(content: string): ParsedBookResult {
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

  private isEpubContentManifestItem(item: ManifestItem): boolean {
    const mediaType = String(item['media-type'] || '')
      .trim()
      .toLowerCase()
    if (!mediaType) {
      return true
    }
    return BookParserService.EPUB_CONTENT_MEDIA_TYPES.has(mediaType)
  }

  private async readEpubChapterRaw(epub: EPub, id: string | undefined): Promise<string | null> {
    if (!id) {
      return null
    }

    try {
      return await epub.getChapterRaw(id)
    } catch {
      return null
    }
  }

  private resolveEpubChapterTitle(
    item: ManifestItem,
    tocTitleById: Map<string, string>,
    tocTitleByHref: Map<string, string>,
    chapterIndex: number
  ): string {
    const itemTitle = (item as { title?: unknown }).title
    if (typeof itemTitle === 'string' && itemTitle.trim()) {
      return itemTitle.trim()
    }

    const byId = item.id ? tocTitleById.get(item.id) : null
    if (byId && byId.trim()) {
      return byId.trim()
    }

    const byHref = item.href ? tocTitleByHref.get(this.normalizeEpubHref(item.href)) : null
    if (byHref && byHref.trim()) {
      return byHref.trim()
    }

    return `Chapter ${chapterIndex + 1}`
  }

  private normalizeEpubHref(href: string): string {
    return href.split('#')[0].trim().toLowerCase()
  }

  private normalizeEpubMetadataField(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized ? normalized : null
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
