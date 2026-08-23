import { describe, expect, it } from 'vitest';

import { coverTintForVolume, paragraphsFromBody, VOLUME_COVER_TINTS } from '@/features/content/content-model';

describe('coverTintForVolume', () => {
  it('picks a stable tint from the VOLUME_COVER_TINTS set', () => {
    const tint = coverTintForVolume(['story'], 'Ocean Tales');
    expect(VOLUME_COVER_TINTS).toContain(tint);
    expect(coverTintForVolume(['story'], 'Ocean Tales')).toBe(tint);
  });
});

describe('paragraphsFromBody', () => {
  it('splits on blank lines', () => {
    expect(paragraphsFromBody('One.\n\nTwo.\n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(paragraphsFromBody('   ')).toEqual([]);
  });
});
