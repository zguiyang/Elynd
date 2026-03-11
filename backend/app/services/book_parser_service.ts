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
    const manifest = this.getEpubManifest(epub)
    const flatStructure = this.flattenStructure(structure)
    const sectionMap = new Map(sections.map((section) => [section.id, section]))
    const chapters: ParsedBookChapter[] = []

    for (let i = 0; i < flatStructure.length; i++) {
      const node = flatStructure[i]
      const pathRef = typeof node?.path === 'string' ? node.path : ''
      const filePath = pathRef.split('#')[0]

      if (!filePath) {
        continue
      }

      const nodeId = this.getNodeId(node)
      const sectionId = node?.sectionId || this.resolveSectionIdFromPath(pathRef, manifest)
      const section = sectionId ? sectionMap.get(String(sectionId)) : null
      const rawContent = section?.htmlString || ''

      if (!rawContent) {
        continue
      }

      const nextNodeId = this.findNextNodeIdInSameFile(flatStructure, i, filePath)
      const fragment = this.extractHtmlFragment(rawContent, nodeId, nextNodeId)
      const content = this.cleanContent(fragment.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '))

      if (!content) {
        continue
      }

      chapters.push({
        chapterIndex: chapters.length,
        title: String(node?.name || `Chapter ${chapters.length + 1}`),
        content,
        wordCount: this.countWords(content),
      })
    }

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

  private getEpubManifest(epub: unknown): Array<{ id: string; href: string }> {
    const manifest = (epub as { _manifest?: Array<{ id: string; href: string }> })._manifest
    return Array.isArray(manifest) ? manifest : []
  }

  private flattenStructure(nodes: any[]): any[] {
    const result: any[] = []

    const visit = (node: any) => {
      result.push(node)
      const children = Array.isArray(node?.children) ? node.children : []
      for (const child of children) {
        visit(child)
      }
    }

    for (const node of nodes) {
      visit(node)
    }

    return result
  }

  private getNodeId(node: any): string | null {
    if (node?.nodeId) {
      return String(node.nodeId)
    }

    const pathRef = typeof node?.path === 'string' ? node.path : ''
    const hash = pathRef.split('#')[1]
    return hash ? String(hash) : null
  }

  private resolveSectionIdFromPath(
    pathRef: string,
    manifest: Array<{ id: string; href: string }>
  ): string | null {
    const name = this.getLinkName(pathRef)
    if (!name) {
      return null
    }

    const matched = manifest.find((item) => this.getLinkName(item.href) === name)
    return matched?.id ?? null
  }

  private getLinkName(href: string): string | null {
    if (!href) {
      return null
    }

    const url = href.split('#')[0]
    const filename = url.split('/').pop() || ''

    if (!filename) {
      return null
    }

    const parts = filename.split('.')
    if (parts.length <= 1) {
      return filename
    }

    parts.pop()
    return parts.join('.')
  }

  private findNextNodeIdInSameFile(nodes: any[], startIndex: number, filePath: string) {
    for (let i = startIndex + 1; i < nodes.length; i++) {
      const pathRef = typeof nodes[i]?.path === 'string' ? nodes[i].path : ''
      if (pathRef.split('#')[0] !== filePath) {
        continue
      }

      const nodeId = this.getNodeId(nodes[i])
      if (nodeId) {
        return nodeId
      }
    }

    return null
  }

  private extractHtmlFragment(html: string, nodeId: string | null, nextNodeId: string | null) {
    if (!nodeId) {
      return html
    }

    const startIndex = this.findAnchorIndex(html, nodeId)
    if (startIndex === -1) {
      return html
    }

    if (nextNodeId) {
      const endIndex = this.findAnchorIndex(html, nextNodeId)
      if (endIndex > startIndex) {
        return html.slice(startIndex, endIndex)
      }
    }

    return html.slice(startIndex)
  }

  private findAnchorIndex(html: string, anchorId: string): number {
    const escaped = anchorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(`id=["']${escaped}["']`, 'i'),
      new RegExp(`name=["']${escaped}["']`, 'i'),
    ]

    for (const pattern of patterns) {
      const matchIndex = html.search(pattern)
      if (matchIndex === -1) {
        continue
      }

      const tagStart = html.lastIndexOf('<', matchIndex)
      return tagStart === -1 ? matchIndex : tagStart
    }

    return -1
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
