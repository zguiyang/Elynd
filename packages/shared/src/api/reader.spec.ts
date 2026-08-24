import { describe, expect, it } from 'vitest';

import { updateReadingStateBodySchema } from './reader.ts';

describe('reader api contracts', () => {
  it('requires at least one state field', () => {
    expect(updateReadingStateBodySchema.safeParse({}).success).toBe(false);
    expect(updateReadingStateBodySchema.parse({ progressRatio: 40 })).toEqual({ progressRatio: 40 });
  });
});
