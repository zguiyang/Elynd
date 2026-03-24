import { convert } from 'html-to-text'

const LEADING_DANGLING_ATTR_RE = /^(?:\s*[A-Za-z][A-Za-z0-9:-]*="[^"]*">\s*)+/gm
const TRAILING_DANGLING_TAG_RE = /\s*<\s*[A-Za-z][^>\n]*$/gm
const HTML_RESIDUE_RE = /<[^>]+>|(?:^\s*[A-Za-z][A-Za-z0-9:-]*="[^"]*">\s*)+/m
const DIVIDER_RE = /^[-*_—–\s]{3,}$/
const FRONT_MATTER_KEYWORDS = [
  'copyright',
  'all rights reserved',
  'first published',
  'printed and bound',
  'publisher',
  'publishing',
  'illustrated by',
  'dedication',
  'foreword',
  'preface',
  'acknowledgments',
  'acknowledgements',
  'contents',
  'table of contents',
  'index',
  'appendix',
]

const FRONT_MATTER_TITLE_KEYWORDS = [
  'copyright',
  'contents',
  'table of contents',
  'index',
  'appendix',
  'preface',
  'foreword',
  'dedication',
]

export interface CanonicalChapterParts {
  title: string
  content: string
  droppedPrefix: boolean
}

export function extractPlainTextFromHtml(rawHtml: string): string {
  if (!rawHtml.trim()) {
    return ''
  }

  try {
    return normalizeBookText(
      convert(rawHtml, {
        wordwrap: false,
        preserveNewlines: true,
      })
    )
  } catch {
    return normalizeBookText(rawHtml)
  }
}

export function normalizeBookText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(LEADING_DANGLING_ATTR_RE, '')
    .replace(TRAILING_DANGLING_TAG_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeSpeechText(content: string): string {
  const normalized = normalizeBookText(content)

  return normalizeBookText(
    normalized
      .replace(/&/g, ' amp ')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–]/g, ' ')
      .replace(/\u00ad/g, '')
      .replace(/ﬁ/g, 'fi')
      .replace(/ﬂ/g, 'fl')
      .replace(/ﬀ/g, 'ff')
      .replace(/ﬃ/g, 'ffi')
      .replace(/ﬄ/g, 'ffl')
  )
}

export function buildCanonicalChapterText(title: string, content: string): string {
  return normalizeSpeechText(`${title}\n\n${content}`)
}

export function extractCanonicalChapterParts(input: {
  title: string
  content: string
}): CanonicalChapterParts {
  const originalTitle = normalizeBookText(input.title)
  const normalizedContent = normalizeSpeechText(input.content)
  const blocks = splitIntoBlocks(normalizedContent)

  if (blocks.length === 0) {
    return {
      title: originalTitle,
      content: '',
      droppedPrefix: false,
    }
  }

  const firstBlock = blocks[0]
  const titleCandidate = isTitleLikeBlock(firstBlock) ? firstBlock : null
  const bodyStartIndex = findBodyStartIndex(blocks, titleCandidate ? 1 : 0)
  const bodyBlocks = removeBlockNoise(blocks.slice(bodyStartIndex))

  if (bodyBlocks.length === 0) {
    return {
      title: titleCandidate || originalTitle,
      content: '',
      droppedPrefix: bodyStartIndex > 0,
    }
  }

  const canonicalTitle = resolveCanonicalTitle({
    originalTitle,
    titleCandidate,
    bodyBlocks,
  })
  const contentBlocks = removeLeadingDuplicateTitle(bodyBlocks, canonicalTitle)

  return {
    title: canonicalTitle,
    content: normalizeBookText(contentBlocks.join('\n\n')),
    droppedPrefix: bodyStartIndex > 0 || contentBlocks.length !== bodyBlocks.length,
  }
}

export function hasHtmlResidue(content: string): boolean {
  return HTML_RESIDUE_RE.test(content)
}

export function hasMarkdownResidue(content: string): boolean {
  return (
    /^\s{0,3}#{1,6}\s+/m.test(content) ||
    /```/.test(content) ||
    /^\s*[-*+]\s+/m.test(content) ||
    /^\s*\d+\.\s+/m.test(content) ||
    /!\[[^\]]*\]\([^)]+\)/.test(content) ||
    /\[[^\]]+\]\([^)]+\)/.test(content)
  )
}

export function isDividerBlock(block: string): boolean {
  return DIVIDER_RE.test(normalizeBookText(block).replace(/\n/g, ''))
}

export function isIllustrationPlaceholder(block: string): boolean {
  const normalized = normalizeBookText(block).replace(/\s+/g, ' ')
  return (
    /^\[illustration\]$/i.test(normalized) ||
    /^\[illustration:\s*.+\]$/i.test(normalized) ||
    /^\[illustration\s+\d+\]$/i.test(normalized)
  )
}

export function isFrontMatterBlock(block: string): boolean {
  const normalized = normalizeBookText(block)
  const lower = normalized.toLowerCase()

  if (!normalized) {
    return true
  }

  if (isDividerBlock(normalized) || isIllustrationPlaceholder(normalized)) {
    return true
  }

  if (FRONT_MATTER_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true
  }

  if (/^(?:by\s+|illustrated by\s+)/i.test(normalized)) {
    return true
  }

  if (
    isMostlyUppercase(normalized) &&
    /\b\d{4}\b/.test(normalized) &&
    normalized.split(/\s+/).filter(Boolean).length <= 10 &&
    /(CO\.?|LTD\.?|LIMITED|PRESS|PUBLISHED|PRINTED|BIND|PUBLISHER|LONDON|BRITAIN)/i.test(normalized)
  ) {
    return true
  }

  return false
}

function isMostlyUppercase(value: string): boolean {
  const letters = value.match(/[A-Za-z]/g) || []
  if (letters.length === 0) {
    return false
  }

  const uppercaseLetters = (value.match(/[A-Z]/g) || []).length
  return uppercaseLetters / letters.length >= 0.7
}

export function splitIntoBlocks(content: string): string[] {
  return normalizeBookText(content)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
}

export function removeBlockNoise(blocks: string[]): string[] {
  return blocks
    .map((block) => normalizeBookText(block))
    .flatMap((block) => {
      if (!block) {
        return []
      }

      const sanitized = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !isDividerBlock(line) && !isIllustrationPlaceholder(line))
        .join('\n')

      if (!sanitized || isDividerBlock(sanitized) || isIllustrationPlaceholder(sanitized)) {
        return []
      }

      return [normalizeBookText(sanitized)]
    })
}

function findBodyStartIndex(blocks: string[], startIndex: number): number {
  for (let index = startIndex; index < blocks.length; index++) {
    if (!isFrontMatterBlock(blocks[index])) {
      return index
    }
  }

  return blocks.length
}

function resolveCanonicalTitle(input: {
  originalTitle: string
  titleCandidate: string | null
  bodyBlocks: string[]
}): string {
  if (input.titleCandidate) {
    return normalizeBookText(input.titleCandidate)
  }

  const originalTitle = normalizeBookText(input.originalTitle)
  if (!isFrontMatterTitle(originalTitle)) {
    return originalTitle
  }

  const firstBodyBlock = input.bodyBlocks[0] || ''
  if (isTitleLikeBlock(firstBodyBlock) && !isFrontMatterBlock(firstBodyBlock)) {
    return normalizeBookText(firstBodyBlock)
  }

  return originalTitle
}

function removeLeadingDuplicateTitle(blocks: string[], title: string): string[] {
  if (blocks.length === 0) {
    return blocks
  }

  const firstBlock = normalizeBookText(blocks[0])
  const normalizedTitle = normalizeBookText(title)
  if (normalizeComparable(firstBlock) === normalizeComparable(normalizedTitle)) {
    return blocks.slice(1)
  }

  return blocks
}

function isFrontMatterTitle(title: string): boolean {
  const lower = normalizeComparable(title)
  return FRONT_MATTER_TITLE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

function isTitleLikeBlock(block: string): boolean {
  const normalized = normalizeBookText(block)
  if (!normalized || isFrontMatterBlock(normalized)) {
    return false
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length
  if (wordCount === 0 || wordCount > 12) {
    return false
  }

  if (/[.!?]/.test(normalized)) {
    return false
  }

  if (normalized.length > 120) {
    return false
  }

  return true
}

function normalizeComparable(value: string): string {
  return normalizeBookText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
