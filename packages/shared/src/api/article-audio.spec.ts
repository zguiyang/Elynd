import { describe, expect, it } from 'vitest';

import {
  articleAudioBodyTextOffsetBase,
  buildArticleAudioText,
  normalizeArticleAudioWhitespace,
} from './article-audio.ts';

describe('article audio synth text SSOT', () => {
  it('collapses whitespace', () => {
    expect(normalizeArticleAudioWhitespace('  Hello   world\n\n ')).toBe('Hello world');
  });

  it('joins title and body with blank line', () => {
    expect(buildArticleAudioText('  Ocean  ', 'Deep\n\nblue  sea.')).toBe('Ocean\n\nDeep blue sea.');
  });

  it('omits empty sides', () => {
    expect(buildArticleAudioText('', 'Only body')).toBe('Only body');
    expect(buildArticleAudioText('Only title', '  ')).toBe('Only title');
  });

  it('computes body textOffset base after title and separators', () => {
    expect(articleAudioBodyTextOffsetBase('Ocean', 'Deep blue')).toBe('Ocean'.length + 2);
    expect(articleAudioBodyTextOffsetBase('', 'Deep blue')).toBe(0);
    expect(articleAudioBodyTextOffsetBase('Ocean', '')).toBe(0);
  });
});
