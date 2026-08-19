import { describe, expect, it } from 'vitest';

import { pickDailyReviewItems } from '@/modules/review/pick';

describe('pickDailyReviewItems', () => {
  it('prefers items that have never entered a queue', () => {
    const picked = pickDailyReviewItems([
      { id: 'old', articleId: 'a', sortOrder: 1, lastAppearedOn: '2026-08-01' },
      { id: 'new', articleId: 'z', sortOrder: 9, lastAppearedOn: null },
    ]);
    expect(picked.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('then prefers the longest gap, then articleId + sortOrder', () => {
    const picked = pickDailyReviewItems([
      { id: 'b2', articleId: 'b', sortOrder: 2, lastAppearedOn: '2026-08-10' },
      { id: 'a1', articleId: 'a', sortOrder: 1, lastAppearedOn: '2026-08-10' },
      { id: 'c1', articleId: 'c', sortOrder: 1, lastAppearedOn: '2026-08-01' },
    ]);
    expect(picked.map((item) => item.id)).toEqual(['c1', 'a1', 'b2']);
  });

  it('caps without padding', () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      id: `i${index}`,
      articleId: 'a',
      sortOrder: index + 1,
      lastAppearedOn: null,
    }));
    expect(pickDailyReviewItems(candidates)).toHaveLength(10);
    expect(pickDailyReviewItems(candidates.slice(0, 3))).toHaveLength(3);
    expect(pickDailyReviewItems([])).toEqual([]);
  });
});
