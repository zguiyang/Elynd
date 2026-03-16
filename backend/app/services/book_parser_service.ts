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

interface EpubTocItem {
  title: string
  hrefBase: string
  anchor: string | null
}

@inject()
export class BookParserService {
  private static readonly MAX_FILE_SIZE = 4 * 1024 * 1024
  private static readonly ALLOWED_EXTENSIONS = ['epub']
  private static readonly EPUB_CONTENT_MEDIA_TYPES = new Set(['application/xhtml+xml', 'text/html'])

  validateFile(file: MultipartFile) {
    const ext = (file.extname || '').toLowerCase()
    const size = file.size ?? 0

    if (!BookParserService.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Exception('Only .epub files are supported', { status: 400 })
    }

    if (size > BookParserService.MAX_FILE_SIZE) {
      throw new Exception('File size exceeds 4MB limit', { status: 400 })
    }

    if (!file.tmpPath) {
      throw new Exception('Failed to read uploaded file', { status: 400 })
    }
  }

  async parseFileFromStorage(
    _storagePath: string,
    absolutePath: string,
    extname: string
  ): Promise<ParsedBookResult> {
    const ext = extname.toLowerCase()
    if (ext === 'epub') {
      return this.parseEpub(absolutePath)
    }
    throw new Exception('Only .epub files are supported', { status: 400 })
  }

  async parseEpub(path: string): Promise<ParsedBookResult> {
    const epub = new EPub(path)
    await epub.parse()

    const flow = Array.isArray(epub.flow) ? epub.flow : []
    const toc = Array.isArray(epub.toc) ? epub.toc : []
    const tocItems = this.flattenEpubToc(toc)
    const chapters =
      tocItems.length > 0
        ? await this.parseEpubByToc(epub, flow, tocItems)
        : await this.parseEpubByFlow(epub, flow)

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
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
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

  private normalizeEpubHref(href: string): string {
    return href.split('#')[0].trim().toLowerCase()
  }

  private extractEpubAnchor(href: string): string | null {
    const parts = href.split('#')
    if (parts.length < 2) {
      return null
    }
    const anchor = parts[1].trim()
    return anchor ? anchor : null
  }

  private flattenEpubToc(items: unknown[]): EpubTocItem[] {
    const flattened: EpubTocItem[] = []

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') {
        return
      }

      const item = node as {
        title?: unknown
        href?: unknown
        subitems?: unknown[]
        children?: unknown[]
      }
      const hrefRaw = typeof item.href === 'string' ? item.href.trim() : ''
      if (hrefRaw) {
        flattened.push({
          title: typeof item.title === 'string' ? item.title.trim() : '',
          hrefBase: this.normalizeEpubHref(hrefRaw),
          anchor: this.extractEpubAnchor(hrefRaw),
        })
      }

      if (Array.isArray(item.subitems)) {
        item.subitems.forEach(visit)
      }
      if (Array.isArray(item.children)) {
        item.children.forEach(visit)
      }
    }

    items.forEach(visit)
    return flattened
  }

  private async parseEpubByToc(
    epub: EPub,
    flow: ManifestItem[],
    tocItems: EpubTocItem[]
  ): Promise<ParsedBookChapter[]> {
    const flowByHref = new Map<string, ManifestItem>()
    for (const item of flow) {
      if (!this.isEpubContentManifestItem(item) || !item.href) {
        continue
      }
      flowByHref.set(this.normalizeEpubHref(item.href), item)
    }

    const rawCache = new Map<string, string>()
    const chapters: ParsedBookChapter[] = []

    for (let i = 0; i < tocItems.length; i++) {
      const current = tocItems[i]
      const next = i + 1 < tocItems.length ? tocItems[i + 1] : null
      const raw = await this.readRawByHref(epub, flowByHref, rawCache, current.hrefBase)
      if (!raw) {
        continue
      }

      const sectionRaw = this.sliceHtmlSectionByAnchors(
        raw,
        current.anchor,
        next && next.hrefBase === current.hrefBase ? next.anchor : null
      )
      const content = this.stripLeadingTitleBlock(
        this.cleanContent(this.htmlToText(sectionRaw)),
        current.title
      )
      if (!content) {
        continue
      }

      chapters.push({
        chapterIndex: chapters.length,
        title: current.title || `Chapter ${chapters.length + 1}`,
        content,
        wordCount: this.countWords(content),
      })
    }

    if (chapters.length > 0) {
      return chapters
    }

    return this.parseEpubByFlow(epub, flow)
  }

  private async parseEpubByFlow(epub: EPub, flow: ManifestItem[]): Promise<ParsedBookChapter[]> {
    const chapters: ParsedBookChapter[] = []

    for (const item of flow) {
      if (!this.isEpubContentManifestItem(item)) {
        continue
      }

      const rawContent = await this.readEpubChapterRaw(epub, item.id)
      if (!rawContent) {
        continue
      }

      const generatedTitle = `Chapter ${chapters.length + 1}`
      const content = this.stripLeadingTitleBlock(
        this.cleanContent(this.htmlToText(rawContent)),
        generatedTitle
      )
      if (!content) {
        continue
      }

      chapters.push({
        chapterIndex: chapters.length,
        title: generatedTitle,
        content,
        wordCount: this.countWords(content),
      })
    }

    return chapters
  }

  private async readRawByHref(
    epub: EPub,
    flowByHref: Map<string, ManifestItem>,
    rawCache: Map<string, string>,
    hrefBase: string
  ): Promise<string | null> {
    if (rawCache.has(hrefBase)) {
      return rawCache.get(hrefBase) || null
    }

    const flowItem = flowByHref.get(hrefBase)
    if (!flowItem) {
      rawCache.set(hrefBase, '')
      return null
    }

    const raw = await this.readEpubChapterRaw(epub, flowItem.id)
    rawCache.set(hrefBase, raw || '')
    return raw || null
  }

  private sliceHtmlSectionByAnchors(
    rawHtml: string,
    currentAnchor: string | null,
    nextAnchor: string | null
  ): string {
    const start = currentAnchor ? this.findAnchorIndex(rawHtml, currentAnchor, 0) : 0
    const safeStart = start >= 0 ? start : 0
    const end =
      nextAnchor && nextAnchor !== currentAnchor
        ? this.findAnchorIndex(rawHtml, nextAnchor, safeStart + 1)
        : -1

    if (end > safeStart) {
      return rawHtml.slice(safeStart, end)
    }

    return rawHtml.slice(safeStart)
  }

  private findAnchorIndex(rawHtml: string, anchor: string, fromIndex: number): number {
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(`\\sid\\s*=\\s*["']${escaped}["']`, 'i'),
      new RegExp(`\\sname\\s*=\\s*["']${escaped}["']`, 'i'),
      new RegExp(`\\shref\\s*=\\s*["']#${escaped}["']`, 'i'),
    ]
    const haystack = rawHtml.slice(Math.max(0, fromIndex))

    for (const pattern of patterns) {
      const relative = haystack.search(pattern)
      if (relative >= 0) {
        return Math.max(0, fromIndex) + relative
      }
    }

    return -1
  }

  private htmlToText(rawHtml: string): string {
    return rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
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
      const chapterContent = this.stripLeadingTitleBlock(lines.slice(1).join('\n').trim(), title)

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

  private stripLeadingTitleBlock(content: string, title: string): string {
    const normalizedTitle = this.normalizeForTitleCompare(title)
    if (!content || !normalizedTitle) {
      return content
    }

    const lines = content.split('\n')
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift()
    }

    if (lines.length === 0) {
      return ''
    }

    let changed = true
    while (changed && lines.length > 0) {
      changed = false
      while (lines.length > 0 && lines[0].trim() === '') {
        lines.shift()
      }

      if (lines.length === 0) {
        break
      }

      const first = lines[0].trim()
      if (this.isTitleEquivalent(first, title)) {
        lines.shift()
        changed = true
        continue
      }

      let secondIndex = -1
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          secondIndex = i
          break
        }
      }
      if (secondIndex < 0) {
        break
      }

      const second = lines[secondIndex].trim()
      const combined = `${first} ${second}`.trim()
      if (
        this.normalizeForTitleCompare(combined) === normalizedTitle ||
        this.matchesTitlePrefixAndSuffix(first, second, normalizedTitle)
      ) {
        lines.splice(secondIndex, 1)
        lines.shift()
        changed = true
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  private matchesTitlePrefixAndSuffix(
    firstLine: string,
    secondLine: string,
    normalizedTitle: string
  ): boolean {
    const prefixMatch = firstLine.match(/^chapter\s+([0-9ivxlcdm]+)\b[.\-:]*$/i)
    if (!prefixMatch) {
      return false
    }

    const chapterToken = prefixMatch[1]?.toLowerCase() || ''
    const suffixToken = this.normalizeForTitleCompare(secondLine)
    if (!suffixToken) {
      return false
    }

    return normalizedTitle.startsWith(`chapter ${chapterToken}`) && normalizedTitle.includes(suffixToken)
  }

  private isTitleEquivalent(line: string, title: string): boolean {
    return this.normalizeForTitleCompare(line) === this.normalizeForTitleCompare(title)
  }

  private normalizeForTitleCompare(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}
