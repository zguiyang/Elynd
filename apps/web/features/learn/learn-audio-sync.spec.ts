import { describe, expect, it } from 'vitest';

import { buildArticleAudioText } from '@gloaming/shared/api/article-audio';

import {
  activeWordTextOffset,
  articleBodyParagraphWordTokens,
  articleTitleWordTokens,
  bilingualSentenceWordTokens,
  findActiveWordTiming,
  isPunctuationOnlyTimingText,
  resolveActiveDisplayTextOffset,
  resolveAudioHighlightPhase,
  resolveTimingDisplayOffsets,
  sentencePlaybackWindow,
  tokenContainsTextOffset,
} from './learn-audio-sync.ts';

describe('learn audio sync', () => {
  const timings = [
    { text: 'Ocean', audioOffsetMs: 0, durationMs: 200, textOffset: 0 },
    { text: 'Deep', audioOffsetMs: 400, durationMs: 180, textOffset: 7 },
    { text: 'blue', audioOffsetMs: 600, durationMs: 160, textOffset: 12 },
    { text: 'sea.', audioOffsetMs: 800, durationMs: 200, textOffset: 17 },
  ];

  it('keeps the last lexical word until the next one starts (short windows survive sparse samples)', () => {
    expect(findActiveWordTiming(timings, 0)?.text).toBe('Ocean');
    expect(findActiveWordTiming(timings, 199)?.text).toBe('Ocean');
    // Gap after Ocean's duration — still Ocean until Deep starts (continuous follow-along).
    expect(findActiveWordTiming(timings, 250)?.text).toBe('Ocean');
    expect(findActiveWordTiming(timings, 450)?.text).toBe('Deep');
    expect(activeWordTextOffset(timings, 650)).toBe(12);
    expect(findActiveWordTiming(timings, 950)?.text).toBe('sea.');
    expect(findActiveWordTiming(timings, -1)).toBeNull();
  });

  it('skips punctuation-only boundaries when picking the active word', () => {
    const withPunct = [
      { text: 'Hello', audioOffsetMs: 0, durationMs: 80, textOffset: 0 },
      { text: '.', audioOffsetMs: 90, durationMs: 40, textOffset: 5 },
      { text: 'World', audioOffsetMs: 200, durationMs: 80, textOffset: 7 },
    ];
    expect(isPunctuationOnlyTimingText('.')).toBe(true);
    expect(findActiveWordTiming(withPunct, 100)?.text).toBe('Hello');
    expect(findActiveWordTiming(withPunct, 210)?.text).toBe('World');
  });

  it('matches tokens by offset range (punctuation glued to display words)', () => {
    const token = { text: 'sea.', textOffset: 17 };
    expect(tokenContainsTextOffset(token, 17)).toBe(true);
    expect(tokenContainsTextOffset(token, 19)).toBe(true);
    expect(tokenContainsTextOffset(token, 21)).toBe(false);
  });

  it('resolves title/body/idle highlight phases', () => {
    expect(resolveAudioHighlightPhase('Ocean', 'Deep blue sea.', timings, null)).toBe('idle');
    expect(resolveAudioHighlightPhase('Ocean', 'Deep blue sea.', timings, 50)).toBe('title');
    expect(resolveAudioHighlightPhase('Ocean', 'Deep blue sea.', timings, 450)).toBe('body');
    // Continuous strategy: still on title word during gap before body.
    expect(resolveAudioHighlightPhase('Ocean', 'Deep blue sea.', timings, 250)).toBe('title');
  });

  it('tokenizes title and body to match synth textOffset', () => {
    const title = '  Ocean  ';
    const body = 'Deep\n\nblue  sea.';
    const synth = buildArticleAudioText(title, body);
    expect(synth).toBe('Ocean\n\nDeep blue sea.');

    const titleTokens = articleTitleWordTokens(title);
    expect(titleTokens).toEqual([{ text: 'Ocean', textOffset: 0 }]);

    const paragraphs = ['Deep', 'blue  sea.'];
    const bodyTokens = articleBodyParagraphWordTokens(title, body, paragraphs);
    expect(bodyTokens).toEqual([
      [{ text: 'Deep', textOffset: 7 }],
      [
        { text: 'blue', textOffset: 12 },
        { text: 'sea.', textOffset: 17 },
      ],
    ]);
    expect(synth.slice(7, 11)).toBe('Deep');
    expect(synth.slice(17)).toBe('sea.');
  });

  it('maps bilingual sentences onto body offsets when they appear in order', () => {
    const title = 'Ocean';
    const body = 'Deep blue sea. More later.';
    const mapped = bilingualSentenceWordTokens(title, body, [{ en: 'Deep blue sea.' }, { en: 'More later.' }]);
    expect(mapped[0]?.[0]).toEqual({ text: 'Deep', textOffset: 7 });
    expect(mapped[1]?.[0]).toEqual({ text: 'More', textOffset: 22 });
  });

  it('realigns body words when Azure textOffset treats title/body join as one space', () => {
    // Real synth uses "\n\n" (bodyBase=7). Azure sometimes reports body as if join were " ".
    const title = 'Ocean';
    const body = 'Deep blue sea.';
    const azureAsSingleSpace = [
      { text: 'Ocean', audioOffsetMs: 0, durationMs: 200, textOffset: 0 },
      { text: 'Deep', audioOffsetMs: 400, durationMs: 180, textOffset: 6 },
      { text: 'blue', audioOffsetMs: 600, durationMs: 160, textOffset: 11 },
      { text: 'sea.', audioOffsetMs: 800, durationMs: 200, textOffset: 16 },
    ];
    const map = resolveTimingDisplayOffsets(title, body, azureAsSingleSpace);
    expect(map.get('0:0:Ocean')).toBe(0);
    expect(map.get('6:400:Deep')).toBe(7);
    expect(map.get('11:600:blue')).toBe(12);
    expect(map.get('16:800:sea.')).toBe(17);
    expect(resolveActiveDisplayTextOffset(title, body, azureAsSingleSpace, 450)).toBe(7);
    expect(resolveAudioHighlightPhase(title, body, azureAsSingleSpace, 450)).toBe('body');
  });

  it('clips a body sentence to its word-timing window', () => {
    const title = 'Ocean';
    const body = 'Deep blue sea. More later.';
    const window = sentencePlaybackWindow(title, body, 'Deep blue sea.', [
      { text: 'Ocean', audioOffsetMs: 0, durationMs: 200, textOffset: 0 },
      { text: 'Deep', audioOffsetMs: 400, durationMs: 180, textOffset: 7 },
      { text: 'blue', audioOffsetMs: 600, durationMs: 160, textOffset: 12 },
      { text: 'sea.', audioOffsetMs: 800, durationMs: 200, textOffset: 17 },
      { text: 'More', audioOffsetMs: 1100, durationMs: 160, textOffset: 22 },
      { text: 'later.', audioOffsetMs: 1300, durationMs: 180, textOffset: 27 },
    ]);
    expect(window).toEqual({ startMs: 400, endMs: 1000 });
    expect(sentencePlaybackWindow(title, body, 'No such sentence.', timings)).toBeNull();
  });
});
