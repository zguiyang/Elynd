import { describe, expect, it } from 'vitest';

import { updateReadingProgressBodySchema } from './reader.ts';

describe('reader api contracts', () => {
  it('requires at least one progress field', () => {
    expect(updateReadingProgressBodySchema.safeParse({}).success).toBe(false);
    expect(updateReadingProgressBodySchema.parse({ progressRatio: 40 })).toEqual({ progressRatio: 40 });
  });
});
