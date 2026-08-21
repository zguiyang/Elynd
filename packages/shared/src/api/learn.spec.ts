import { describe, expect, it } from 'vitest';

import {
  LEARN_SHELF_ITEMS_LIMIT,
  LEARN_TODAY_RECOMMENDATIONS_LIMIT,
  learnShelfDataSchema,
  learnTodayDataSchema,
  updateReadingProgressBodySchema,
} from './learn.ts';

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

  it('accepts empty and populated shelf payloads', () => {
    expect(learnShelfDataSchema.parse({ current: null, items: [] })).toEqual({ current: null, items: [] });
    const populated = learnShelfDataSchema.parse({
      current: {
        article: {
          id: 'a1',
          title: 'Ocean Quiet',
          level: 'mid',
          themes: ['science'],
          estimatedMinutes: 8,
        },
        progress: {
          status: 'in_progress',
          progressRatio: 40,
          lastReadAt: '2026-08-21T00:00:00.000Z',
          completedAt: null,
        },
      },
      items: [],
    });
    expect(populated.current?.article.id).toBe('a1');
    expect(LEARN_SHELF_ITEMS_LIMIT).toBe(48);
  });
});
