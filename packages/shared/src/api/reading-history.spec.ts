import { describe, expect, it } from 'vitest';

import { calendarDateInTimeZone, readingHistoryDataSchema } from './reading-history.ts';

const valid = {
  today: '2026-08-19',
  activity: [{ date: '2026-08-19', level: 1 as const }],
  completions: [{ date: '2026-08-18', title: 'A Warm Current', articleId: 'art_1' }],
  portrait: {
    consecutiveDays: 1,
    readingDays: 1,
    completedArticles: 1,
    lookedUpWords: 0,
  },
};

describe('reading-history api contracts', () => {
  it('formats a Shanghai calendar date as YYYY-MM-DD', () => {
    expect(calendarDateInTimeZone(new Date('2026-08-18T18:30:00.000Z'))).toBe('2026-08-19');
  });

  it('accepts a sparse binary snapshot', () => {
    expect(readingHistoryDataSchema.parse(valid)).toEqual(valid);
  });

  it('rejects intensity above 1 and malformed dates', () => {
    expect(
      readingHistoryDataSchema.safeParse({
        ...valid,
        activity: [{ date: '2026-08-19', level: 2 }],
      }).success,
    ).toBe(false);
    expect(
      readingHistoryDataSchema.safeParse({
        ...valid,
        today: '2026/08/19',
      }).success,
    ).toBe(false);
  });
});
