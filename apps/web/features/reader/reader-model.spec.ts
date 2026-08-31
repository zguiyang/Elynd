import { describe, expect, it } from 'vitest';

import { isCurrentChapter, resolveAudioRole } from '@/features/reader/reader-model';

describe('isCurrentChapter', () => {
  it('matches only the open part id', () => {
    expect(isCurrentChapter('a', 'a')).toBe(true);
    expect(isCurrentChapter('a', 'b')).toBe(false);
  });
});

describe('resolveAudioRole', () => {
  it('prefers us then uk when no preference', () => {
    expect(resolveAudioRole({ us: true, uk: true })).toBe('us');
    expect(resolveAudioRole({ us: false, uk: true })).toBe('uk');
    expect(resolveAudioRole({ us: false, uk: false })).toBeNull();
  });

  it('honors preference when available, otherwise falls back', () => {
    expect(resolveAudioRole({ us: true, uk: true }, 'uk')).toBe('uk');
    expect(resolveAudioRole({ us: true, uk: false }, 'uk')).toBe('us');
  });
});
