import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Article } from '@elynd/shared/api/articles';

import { normalizeArticle } from './articles-http';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeArticle', () => {
  it('converts Date fields to ISO strings', () => {
    const createdAt = new Date('2024-01-15T10:00:00.000Z');
    const updatedAt = new Date('2024-02-01T12:30:00.000Z');
    const publishedAt = new Date('2024-02-02T08:00:00.000Z');
    const raw = {
      id: 'a1',
      title: 'Hello',
      body: 'World',
      level: 'easy',
      themes: ['science'],
      sourceNote: '',
      status: 'published',
      seriesId: null,
      seriesOrder: null,
      estimatedMinutes: 5,
      createdAt,
      updatedAt,
      publishedAt,
    } satisfies Article;

    expect(normalizeArticle(raw)).toEqual({
      ...raw,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-02-01T12:30:00.000Z',
      publishedAt: '2024-02-02T08:00:00.000Z',
    });
  });

  it('keeps string dates and null publishedAt', () => {
    const raw = {
      id: 'a2',
      title: 'Draft',
      body: '',
      level: 'mid',
      themes: [],
      sourceNote: 'note',
      status: 'draft',
      seriesId: 's1',
      seriesOrder: 1,
      estimatedMinutes: null,
      createdAt: '2024-03-01T00:00:00.000Z',
      updatedAt: '2024-03-01T00:00:00.000Z',
      publishedAt: null,
    } satisfies Article;

    expect(normalizeArticle(raw)).toEqual(raw);
  });
});
