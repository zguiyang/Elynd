import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Article } from '@elynd/shared/api/articles';

import { articleDataSchema, ArticlesRequestError, normalizeArticle, requestArticlesJson } from './articles-http';

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('requestArticlesJson error mapping', () => {
  it('throws ArticlesRequestError with message and details from error JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: '标题无效', details: [{ path: 'title', message: '太短' }] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    try {
      await requestArticlesJson('/api/articles/x', articleDataSchema);
      expect.unreachable('expected ArticlesRequestError');
    } catch (error) {
      expect(error).toBeInstanceOf(ArticlesRequestError);
      expect(error).toMatchObject({
        message: '标题无效',
        status: 400,
        details: [{ path: 'title', message: '太短' }],
      });
    }
  });

  it('throws 502 ArticlesRequestError when response body fails schema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { not: 'an-article' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(requestArticlesJson('/api/articles/x', articleDataSchema)).rejects.toMatchObject({
      message: '响应格式无效',
      status: 502,
    });
  });
});
