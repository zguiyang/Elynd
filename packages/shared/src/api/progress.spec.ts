import { describe, expect, it } from 'vitest';

import { calendarDateInTimeZone, progressDataSchema } from './progress.ts';

const valid = {
  today: '2026-08-19',
  activity: [{ date: '2026-08-19', level: 1 as const }],
  completions: [{ date: '2026-08-18', title: 'A Warm Current', articleId: 'art_1' }],
  portrait: {
    consecutiveDays: 1,
    learningDays: 1,
    completedArticles: 1,
    lookedUpWords: 0,
  },
};

describe('progress api contracts', () => {
  it('formats a Shanghai calendar date as YYYY-MM-DD', () => {
    expect(calendarDateInTimeZone(new Date('2026-08-18T18:30:00.000Z'))).toBe('2026-08-19');
  });

  it('accepts a sparse binary snapshot', () => {
    expect(progressDataSchema.parse(valid)).toEqual(valid);
  });

  it('rejects intensity above 1 and malformed dates', () => {
    expect(
      progressDataSchema.safeParse({
        ...valid,
        activity: [{ date: '2026-08-19', level: 2 }],
      }).success,
    ).toBe(false);
    expect(
      progressDataSchema.safeParse({
        ...valid,
        today: '2026/08/19',
      }).success,
    ).toBe(false);
  });
});
