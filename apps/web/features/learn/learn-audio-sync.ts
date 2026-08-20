import {
  articleAudioBodyTextOffsetBase,
  buildArticleAudioText,
  normalizeArticleAudioWhitespace,
} from '@gloaming/shared/api/article-audio';
import { type TtsWordTiming } from '@gloaming/shared/api/tts';

export type AudioWordToken = {
  text: string;
  /** Inclusive start index in display/synth alignment space. */
  textOffset: number;
};

/** Title vs body vs none — for phase-scoped highlight (single active offset). */
export type AudioHighlightPhase = 'idle' | 'title' | 'body';

/** Azure may emit punctuation-only boundaries; those must not drive highlight. */
export function isPunctuationOnlyTimingText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }
  return /^[^\p{L}\p{N}]+$/u.test(trimmed);
}

function stripEdgePunctuation(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

/**
 * Last non-punctuation word that has started at `timeMs`.
 * Kept until the next lexical word starts (stable follow-along; pause-friendly).
 */
export function findActiveWordTiming(wordTimings: readonly TtsWordTiming[], timeMs: number): TtsWordTiming | null {
  if (wordTimings.length === 0 || !Number.isFinite(timeMs) || timeMs < 0) {
    return null;
  }
  let active: TtsWordTiming | null = null;
  for (const timing of wordTimings) {
    if (timing.audioOffsetMs > timeMs) {
      break;
    }
    if (isPunctuationOnlyTimingText(timing.text)) {
      continue;
    }
    active = timing;
  }
  return active;
}

/**
 * Map Azure timings onto the synth string by sequential text search.
 * Prefer this over raw `textOffset` — Azure offsets can disagree with `\n\n` in our synth text.
 */
export function resolveTimingDisplayOffsets(
  title: string,
  body: string,
  wordTimings: readonly TtsWordTiming[],
): Map<string, number> {
  const synth = buildArticleAudioText(title, body);
  const map = new Map<string, number>();
  let cursor = 0;
  for (const timing of wordTimings) {
    if (isPunctuationOnlyTimingText(timing.text)) {
      continue;
    }
    const key = activeWordSyncKey(timing);
    const needles = [timing.text, stripEdgePunctuation(timing.text)].filter(
      (item, index, all) => item.length > 0 && all.indexOf(item) === index,
    );
    let found = -1;
    let usedLen = 0;
    for (const needle of needles) {
      const index = synth.indexOf(needle, cursor);
      if (index >= 0) {
        found = index;
        usedLen = needle.length;
        break;
      }
    }
    if (found < 0) {
      // Fall back to Azure offset so title-range words can still work.
      map.set(key, timing.textOffset);
      continue;
    }
    map.set(key, found);
    cursor = found + Math.max(1, usedLen);
  }
  return map;
}

/**
 * Display textOffset for the active word (aligned to our synth/DOM tokens).
 */
export function resolveActiveDisplayTextOffset(
  title: string,
  body: string,
  wordTimings: readonly TtsWordTiming[],
  timeMs: number,
): number | null {
  const active = findActiveWordTiming(wordTimings, timeMs);
  if (!active) {
    return null;
  }
  const map = resolveTimingDisplayOffsets(title, body, wordTimings);
  return map.get(activeWordSyncKey(active)) ?? active.textOffset;
}

export function resolveAudioHighlightPhase(
  title: string,
  body: string,
  wordTimings: readonly TtsWordTiming[],
  timeMs: number | null,
): AudioHighlightPhase {
  if (timeMs == null) {
    return 'idle';
  }
  const displayOffset = resolveActiveDisplayTextOffset(title, body, wordTimings, timeMs);
  if (displayOffset == null) {
    return 'idle';
  }
  const bodyBase = articleAudioBodyTextOffsetBase(title, body);
  return displayOffset < bodyBase ? 'title' : 'body';
}

/** @deprecated Prefer resolveActiveDisplayTextOffset with title/body for DOM highlight. */
export function activeWordTextOffset(wordTimings: readonly TtsWordTiming[], timeMs: number): number | null {
  return findActiveWordTiming(wordTimings, timeMs)?.textOffset ?? null;
}

/** True when `offset` falls inside the token's character span in the synth string. */
export function tokenContainsTextOffset(token: AudioWordToken, offset: number): boolean {
  if (token.textOffset < 0) {
    return false;
  }
  return token.textOffset <= offset && offset < token.textOffset + token.text.length;
}

/** Whitespace-separated tokens with offsets into a normalized segment. */
export function tokenizeNormalizedWords(normalized: string, baseOffset: number): AudioWordToken[] {
  if (!normalized) {
    return [];
  }
  const tokens: AudioWordToken[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    tokens.push({
      text: match[0]!,
      textOffset: baseOffset + match.index,
    });
  }
  return tokens;
}

export function articleTitleWordTokens(title: string): AudioWordToken[] {
  const normalized = normalizeArticleAudioWhitespace(title);
  return tokenizeNormalizedWords(normalized, 0);
}

export function articleBodyParagraphWordTokens(title: string, body: string, paragraphs: string[]): AudioWordToken[][] {
  const bodyBase = articleAudioBodyTextOffsetBase(title, body);
  const result: AudioWordToken[][] = [];
  let cursor = bodyBase;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const normalized = normalizeArticleAudioWhitespace(paragraphs[index] ?? '');
    result.push(tokenizeNormalizedWords(normalized, cursor));
    cursor += normalized.length;
    if (index < paragraphs.length - 1 && normalized) {
      cursor += 1; // single space between paragraphs in synth body
    }
  }
  return result;
}

/**
 * Locate bilingual English sentences inside normalized body and tokenize with synth offsets.
 * Falls back to empty tokens when a sentence cannot be found in order.
 */
export function bilingualSentenceWordTokens(
  title: string,
  body: string,
  sentences: ReadonlyArray<{ en: string }>,
): AudioWordToken[][] {
  const bodyBase = articleAudioBodyTextOffsetBase(title, body);
  const normalizedBody = normalizeArticleAudioWhitespace(body);
  const result: AudioWordToken[][] = [];
  let searchFrom = 0;
  for (const sentence of sentences) {
    const normalized = normalizeArticleAudioWhitespace(sentence.en);
    if (!normalized) {
      result.push([]);
      continue;
    }
    const foundAt = normalizedBody.indexOf(normalized, searchFrom);
    if (foundAt < 0) {
      result.push(tokenizeNormalizedWords(normalized, -1));
      continue;
    }
    result.push(tokenizeNormalizedWords(normalized, bodyBase + foundAt));
    searchFrom = foundAt + normalized.length;
  }
  return result;
}

/** Stable identity for sync throttling (word change only). */
export function activeWordSyncKey(timing: TtsWordTiming | null): string {
  if (!timing) {
    return 'none';
  }
  return `${timing.textOffset}:${timing.audioOffsetMs}:${timing.text}`;
}

export type SentencePlaybackWindow = {
  startMs: number;
  endMs: number;
};

/**
 * Clip window for one article sentence using synth-aligned word timings.
 * `body` should be the same text used to generate the track (typically paragraphs joined by blank lines).
 */
export function sentencePlaybackWindow(
  title: string,
  body: string,
  sentence: string,
  wordTimings: readonly TtsWordTiming[],
): SentencePlaybackWindow | null {
  const needle = normalizeArticleAudioWhitespace(sentence);
  if (!needle || wordTimings.length === 0) {
    return null;
  }

  const synth = buildArticleAudioText(title, body);
  let foundAt = synth.indexOf(needle);
  if (foundAt < 0) {
    const normalizedBody = normalizeArticleAudioWhitespace(body);
    const inBody = normalizedBody.indexOf(needle);
    if (inBody < 0) {
      return null;
    }
    foundAt = articleAudioBodyTextOffsetBase(title, body) + inBody;
  }
  const foundEnd = foundAt + needle.length;

  const displayMap = resolveTimingDisplayOffsets(title, body, wordTimings);
  const overlapping: TtsWordTiming[] = [];
  for (const timing of wordTimings) {
    if (isPunctuationOnlyTimingText(timing.text)) {
      continue;
    }
    const display = displayMap.get(activeWordSyncKey(timing)) ?? timing.textOffset;
    const wordLen = Math.max(1, timing.text.length);
    if (display < foundEnd && display + wordLen > foundAt) {
      overlapping.push(timing);
    }
  }
  if (overlapping.length === 0) {
    return null;
  }

  const first = overlapping[0]!;
  const last = overlapping[overlapping.length - 1]!;
  const startMs = first.audioOffsetMs;
  const endMs = last.audioOffsetMs + last.durationMs;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return { startMs, endMs };
}
