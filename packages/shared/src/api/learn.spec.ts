import { describe, expect, it } from 'vitest';

import { LEARN_TODAY_RECOMMENDATIONS_LIMIT, learnTodayDataSchema, updateReadingProgressBodySchema } from './learn.ts';

describe('learn api contracts', () => {
  it('accepts today payload with up to three unread recommendations', () => {
    const parsed = learnTodayDataSchema.parse({
      current: null,
      continueReading: [],
      recommendations: [
        {
          id: 'a1',
          title: 'A Warm Current',
          level: 'mid',
          themes: ['science'],
          estimatedMinutes: 6,
        },
      ],
    });
    expect(parsed.recommendations).toHaveLength(1);
    expect(LEARN_TODAY_RECOMMENDATIONS_LIMIT).toBe(3);
    expect(
      learnTodayDataSchema.safeParse({
        current: null,
        continueReading: [],
        recommendations: Array.from({ length: 4 }, (_, index) => ({
          id: `a${index}`,
          title: `Title ${index}`,
          level: 'easy',
          themes: [],
          estimatedMinutes: null,
        })),
      }).success,
    ).toBe(false);
  });

  it('requires at least one progress field', () => {
    expect(updateReadingProgressBodySchema.safeParse({}).success).toBe(false);
    expect(updateReadingProgressBodySchema.parse({ progressRatio: 40 })).toEqual({ progressRatio: 40 });
  });
});
