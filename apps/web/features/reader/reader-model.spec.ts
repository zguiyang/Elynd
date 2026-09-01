import { describe, expect, it } from 'vitest';

import {
  DEFAULT_READER_PLAYBACK_RATE,
  formatPlaybackRate,
  isCurrentChapter,
  nextPlaybackRate,
  READER_PLAYBACK_RATES,
  type ReaderPlaybackRate,
  resolveAudioRole,
} from '@/features/reader/reader-model';

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

describe('playback rate', () => {
  it('defaults to 1×', () => {
    expect(DEFAULT_READER_PLAYBACK_RATE).toBe(1);
    expect(formatPlaybackRate(DEFAULT_READER_PLAYBACK_RATE)).toBe('1×');
  });

  it('cycles 0.5 → 1 → 1.5 → 2 → 0.5', () => {
    let rate: ReaderPlaybackRate = READER_PLAYBACK_RATES[0];
    expect(rate).toBe(0.5);
    rate = nextPlaybackRate(rate);
    expect(rate).toBe(1);
    rate = nextPlaybackRate(rate);
    expect(rate).toBe(1.5);
    rate = nextPlaybackRate(rate);
    expect(rate).toBe(2);
    rate = nextPlaybackRate(rate);
    expect(rate).toBe(0.5);
  });

  it('formats rates with ×', () => {
    expect(formatPlaybackRate(0.5)).toBe('0.5×');
    expect(formatPlaybackRate(1.5)).toBe('1.5×');
    expect(formatPlaybackRate(2)).toBe('2×');
  });
});
