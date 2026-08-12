import { describe, expect, it } from 'vitest';

import {
  coverTintForVolume,
  DEFAULT_LIBRARY_SORT_PRESET,
  isDefaultLibrarySort,
  paragraphsFromBody,
  parseLibrarySortBy,
  parseLibrarySortOrder,
  resolveLibrarySortPreset,
  VOLUME_COVER_TINTS,
} from '@/features/library/library-model';

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

describe('library sort presets', () => {
  it('parses sort query params and resolves presets', () => {
    expect(parseLibrarySortBy('updatedAt')).toBe('updatedAt');
    expect(parseLibrarySortBy('nope')).toBe('publishedAt');
    expect(parseLibrarySortOrder('asc')).toBe('asc');
    expect(parseLibrarySortOrder(null)).toBe('desc');
    expect(resolveLibrarySortPreset('updatedAt', 'desc').label).toBe('最近更新');
    expect(resolveLibrarySortPreset('updatedAt', 'asc')).toEqual(DEFAULT_LIBRARY_SORT_PRESET);
    expect(isDefaultLibrarySort('publishedAt', 'desc')).toBe(true);
    expect(isDefaultLibrarySort('createdAt', 'desc')).toBe(false);
  });
});
