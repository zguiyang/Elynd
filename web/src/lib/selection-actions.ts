const EDGE_PUNCTUATION_REGEX = /^[^A-Za-z]+|[^A-Za-z]+$/g
const WORD_PATTERN = /^[A-Za-z]+(?:['-][A-Za-z]+)*$/
type SegmenterToken = { segment: string; isWordLike?: boolean }
type SegmenterInstance = { segment: (input: string) => Iterable<SegmenterToken> }
type SegmenterConstructor = new (
  locale: string,
  options: { granularity: 'word' }
) => SegmenterInstance

const normalizeQuotes = (text: string) => {
  return text
    .replace(/[\u2018\u2019\u2032]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
}

export const normalizeSelectionText = (text: string): string => {
  const normalized = normalizeQuotes(text).trim()
  return normalized.replace(EDGE_PUNCTUATION_REGEX, '').trim()
}

const isWordBoundaryChar = (char: string | null) => {
  if (!char) return true
  return !/[A-Za-z'-]/.test(char)
}

const getRangeBoundaryChars = (range: Range): { before: string | null; after: string | null } => {
  const startContainer = range.startContainer
  const endContainer = range.endContainer

  let before: string | null = null
  let after: string | null = null

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const text = startContainer.textContent || ''
    before = range.startOffset > 0 ? text.charAt(range.startOffset - 1) : null
  }

  if (endContainer.nodeType === Node.TEXT_NODE) {
    const text = endContainer.textContent || ''
    after = range.endOffset < text.length ? text.charAt(range.endOffset) : null
  }

  return { before, after }
}

const isSingleWordBySegmenter = (text: string): boolean | null => {
  const segmenterConstructor = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter
  if (!segmenterConstructor) {
    return null
  }

  const segmenter = new segmenterConstructor('en', { granularity: 'word' })
  const tokens = Array.from(segmenter.segment(text))
    .filter((item) => item.isWordLike)
    .map((item) => item.segment)

  if (tokens.length !== 1) {
    return false
  }

  return WORD_PATTERN.test(tokens[0] || '')
}

export const isSingleWordSelection = (text: string, range?: Range | null): boolean => {
  const normalized = normalizeSelectionText(text)

  if (!normalized) {
    return false
  }

  const segmenterResult = isSingleWordBySegmenter(normalized)
  if (segmenterResult === false && !WORD_PATTERN.test(normalized)) {
    return false
  }

  if (segmenterResult === null && !WORD_PATTERN.test(normalized)) {
    return false
  }

  if (range) {
    const { before, after } = getRangeBoundaryChars(range)
    if (!isWordBoundaryChar(before) || !isWordBoundaryChar(after)) {
      return false
    }
  }

  return true
}
