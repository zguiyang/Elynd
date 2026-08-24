import { describe, expect, it } from 'vitest';

import { SHELF_ITEMS_LIMIT, shelfDataSchema } from './shelf.ts';

describe('shelf api contracts', () => {
  it('accepts empty and populated shelf payloads', () => {
    expect(shelfDataSchema.parse({ current: null, items: [] })).toEqual({ current: null, items: [] });
    const populated = shelfDataSchema.parse({
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
    expect(SHELF_ITEMS_LIMIT).toBe(48);
  });
});
