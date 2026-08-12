import { describe, expect, it } from 'vitest';

import {
  ARTICLE_BODY_MAX_WORDS,
  countArticleWords,
  createArticleBodySchema,
  DEFAULT_LIBRARY_ARTICLE_SORT_BY,
  getPublishArticleIssues,
  libraryArticleListQuerySchema,
  updateArticleBodySchema,
} from './articles.ts';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_ORDER } from './pagination.ts';

describe('article api contracts', () => {
  it('counts words like the admin paste form', () => {
    expect(countArticleWords('')).toBe(0);
    expect(countArticleWords('  one two  three ')).toBe(3);
  });

  it('accepts create draft with title only and defaults', () => {
    const parsed = createArticleBodySchema.parse({ title: 'Hello' });
    expect(parsed).toMatchObject({
      title: 'Hello',
      body: '',
      level: 'easy',
      themes: [],
      sourceNote: '',
      seriesId: null,
      seriesOrder: null,
      estimatedMinutes: null,
    });
  });

  it('rejects seriesOrder without seriesId on create', () => {
    const result = createArticleBodySchema.safeParse({ title: 'Hello', seriesOrder: 1 });
    expect(result.success).toBe(false);
  });

  it('allows patch to clear nullable series fields', () => {
    const parsed = updateArticleBodySchema.parse({ seriesId: null, seriesOrder: null });
    expect(parsed.seriesId).toBeNull();
    expect(parsed.seriesOrder).toBeNull();
  });

  it('enforces publish gate for words and required fields', () => {
    const longBody = Array.from({ length: ARTICLE_BODY_MAX_WORDS + 1 }, (_, i) => `w${i}`).join(' ');
    expect(
      getPublishArticleIssues({
        title: 'T',
        body: longBody,
        sourceNote: 'note',
        themes: ['story'],
        seriesId: null,
        seriesOrder: null,
      }),
    ).toEqual([
      {
        path: 'body',
        message: `正文最多 ${ARTICLE_BODY_MAX_WORDS} 词（当前 ${ARTICLE_BODY_MAX_WORDS + 1}）`,
      },
    ]);

    expect(
      getPublishArticleIssues({
        title: 'T',
        body: 'short body',
        sourceNote: 'note',
        themes: ['story'],
        seriesId: 'rain',
        seriesOrder: null,
      }),
    ).toEqual([
      {
        path: 'seriesOrder',
        message: '系列 ID 与系列顺序需同时填写或同时留空',
      },
    ]);
  });

  it('returns Chinese messages for missing publish fields', () => {
    expect(
      getPublishArticleIssues({
        title: '',
        body: '',
        sourceNote: '',
        themes: [],
        seriesId: null,
        seriesOrder: null,
      }),
    ).toEqual([
      { path: 'title', message: '发布前请填写标题' },
      { path: 'body', message: '发布前请填写正文' },
      { path: 'sourceNote', message: '发布前请填写来源说明' },
      { path: 'themes', message: '发布前请至少添加一个主题' },
    ]);
  });

  it('defaults library list query pagination and sort', () => {
    expect(libraryArticleListQuerySchema.parse({})).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: DEFAULT_LIBRARY_ARTICLE_SORT_BY,
      sortOrder: DEFAULT_SORT_ORDER,
      theme: undefined,
      q: undefined,
    });
  });

  it('parses library list filters from query strings', () => {
    expect(
      libraryArticleListQuerySchema.parse({
        page: '2',
        pageSize: '5',
        sortBy: 'updatedAt',
        sortOrder: 'asc',
        theme: ' science ',
        q: ' rain ',
      }),
    ).toEqual({
      page: 2,
      pageSize: 5,
      sortBy: 'updatedAt',
      sortOrder: 'asc',
      theme: 'science',
      q: 'rain',
    });
  });
});
