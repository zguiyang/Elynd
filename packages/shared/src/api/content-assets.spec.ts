import { describe, expect, it } from 'vitest';

import { buildPartAudioText, normalizePartAudioWhitespace } from './content-assets.ts';

describe('buildPartAudioText', () => {
  it('normalizes body plain text for TTS (body-only SSOT)', () => {
    expect(buildPartAudioText('  Hello   world  ')).toBe('Hello world');
    expect(buildPartAudioText('')).toBe('');
  });

  it('does not incorporate a chapter title', () => {
    const body = normalizePartAudioWhitespace('A Wolf resolved to disguise himself.');
    expect(buildPartAudioText(body)).toBe(body);
    expect(buildPartAudioText(body)).not.toContain('THE WOLF');
  });
});
