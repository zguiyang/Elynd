import { describe, expect, it } from 'vitest';

import {
  ARTICLE_BODY_MAX_WORDS,
  countArticleWords,
  createArticleBodySchema,
  getPublishArticleIssues,
  updateArticleBodySchema,
} from './articles.ts';

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
        message: `body must be at most ${ARTICLE_BODY_MAX_WORDS} words (got ${ARTICLE_BODY_MAX_WORDS + 1})`,
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
        message: 'seriesId and seriesOrder must both be set or both be null',
      },
    ]);
  });
});
