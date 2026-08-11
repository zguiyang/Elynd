import { describe, expect, it } from 'vitest';

import {
  aggregateThemes,
  coverTintForVolume,
  filterLibraryArticles,
  LIBRARY_THEME_ALL,
  paragraphsFromBody,
  VOLUME_COVER_TINTS,
} from '@/features/library/library-model';

describe('aggregateThemes', () => {
  it('returns unique themes in first-seen order', () => {
    expect(
      aggregateThemes([
        { themes: ['story', 'science'] },
        { themes: ['science', 'history'] },
        { themes: ['  story  '] },
      ]),
    ).toEqual(['story', 'science', 'history']);
  });
});

describe('filterLibraryArticles', () => {
  const items = [
    { id: '1', title: 'Ocean Tales', themes: ['story', 'science'] },
    { id: '2', title: 'City Lights', themes: ['story'] },
    { id: '3', title: 'Mars Notes', themes: ['science'] },
  ];

  it('filters by theme and query', () => {
    expect(filterLibraryArticles(items, { theme: 'science', query: '' }).map((i) => i.id)).toEqual(['1', '3']);
    expect(filterLibraryArticles(items, { theme: LIBRARY_THEME_ALL, query: 'city' }).map((i) => i.id)).toEqual(['2']);
    expect(filterLibraryArticles(items, { theme: 'story', query: 'science' }).map((i) => i.id)).toEqual(['1']);
  });
});

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
