import { createHash } from 'node:crypto';

export type SplitSentence = {
  index: number;
  paragraphIndex: number;
  en: string;
};

/** Normalize title+body so hash is stable across trivial whitespace churn. */
export function normalizeArticleContent(title: string, body: string): string {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  const normalizedBody = body
    .replace(/\r\n/g, '\n')
    .split(/\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${normalizedTitle}\n\n${normalizedBody}`;
}

export function hashArticleContent(title: string, body: string): string {
  return createHash('sha256').update(normalizeArticleContent(title, body), 'utf8').digest('hex');
}

function paragraphsFromBody(body: string): string[] {
  const trimmed = body.replace(/\r\n/g, '\n').trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Split a paragraph into sentences (English punctuation).
 * Keeps abbreviations like "Mr." / "Dr." / "U.S." from hard-splitting when possible.
 */
function splitParagraphSentences(paragraph: string): string[] {
  const text = paragraph.trim();
  if (!text) {
    return [];
  }

  const dotToken = '<<DOT>>';
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|U\.S|U\.K)\./gi, (match) => match.replace(/\./g, dotToken))
    .replace(/(\d)\.(\d)/g, `$1${dotToken}$2`);

  const rawParts = protectedText.split(/(?<=[.!?])\s+(?=["'“‘([A-Z0-9])/);
  const sentences = rawParts.map((part) => part.split(dotToken).join('.').trim()).filter(Boolean);

  return sentences.length > 0 ? sentences : [text];
}

/** Sentence-split article body; indices are global across paragraphs. */
export function splitArticleSentences(body: string): SplitSentence[] {
  const paragraphs = paragraphsFromBody(body);
  const sentences: SplitSentence[] = [];
  let index = 0;
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex]!;
    for (const en of splitParagraphSentences(paragraph)) {
      sentences.push({ index, paragraphIndex, en });
      index += 1;
    }
  }
  return sentences;
}

export function formatSentenceListForPrompt(sentences: SplitSentence[]): string {
  return sentences.map((item) => `${item.index}\t${item.en}`).join('\n');
}

export type ParsedTranslateLine = { kind: 'title'; zh: string } | { kind: 'sentence'; index: number; zh: string };

/** Parse one complete model output line (`TITLE\\t…` or `{index}\\t…`). */
export function parseTranslateOutputLine(line: string): ParsedTranslateLine | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const tab = trimmed.indexOf('\t');
  if (tab < 0) {
    return null;
  }
  const head = trimmed.slice(0, tab).trim();
  const zh = trimmed.slice(tab + 1).trim();
  if (!zh) {
    return null;
  }
  if (head.toUpperCase() === 'TITLE') {
    return { kind: 'title', zh };
  }
  if (/^\d+$/.test(head)) {
    return { kind: 'sentence', index: Number(head), zh };
  }
  return null;
}

/**
 * Feed streamed text chunks; yield completed protocol lines as they arrive.
 */
export function createTranslateLineParser(): {
  push: (chunk: string) => ParsedTranslateLine[];
  flush: () => ParsedTranslateLine[];
} {
  let buffer = '';

  function consumeCompleteLines(flushRemainder: boolean): ParsedTranslateLine[] {
    const out: ParsedTranslateLine[] = [];
    while (true) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) {
        break;
      }
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const parsed = parseTranslateOutputLine(line);
      if (parsed) {
        out.push(parsed);
      }
    }
    if (flushRemainder && buffer.trim()) {
      const parsed = parseTranslateOutputLine(buffer);
      buffer = '';
      if (parsed) {
        out.push(parsed);
      }
    } else if (flushRemainder) {
      buffer = '';
    }
    return out;
  }

  return {
    push(chunk: string) {
      buffer += chunk.replace(/\r\n/g, '\n');
      return consumeCompleteLines(false);
    },
    flush() {
      return consumeCompleteLines(true);
    },
  };
}
