import { describe, expect, it } from 'vitest';

import {
  generatePracticeItemsResponseSchema,
  replacePracticeItemsBodySchema,
  updatePracticeAttemptBodySchema,
  updateReadingProgressBodySchema,
} from './learn.ts';

describe('learn api contracts', () => {
  it('requires at least one progress field', () => {
    expect(updateReadingProgressBodySchema.safeParse({}).success).toBe(false);
    expect(updateReadingProgressBodySchema.parse({ progressRatio: 40 })).toEqual({ progressRatio: 40 });
  });

  it('accepts curated practice replace with kind-matched payload', () => {
    const parsed = replacePracticeItemsBodySchema.parse({
      items: [
        {
          kind: 'comprehension',
          payload: { prompt: 'Main idea?', options: ['A', 'B', 'C'] },
          correctOptionIndex: 1,
        },
        {
          kind: 'vocab',
          payload: {
            word: 'gently',
            hint: 'In this text…',
            quote: 'change habits gently',
            options: ['softly', 'fast', 'loudly', 'rarely'],
          },
          correctOptionIndex: 0,
          sortOrder: 2,
        },
      ],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects wrong payload shape for kind and out-of-range answer', () => {
    expect(
      replacePracticeItemsBodySchema.safeParse({
        items: [
          {
            kind: 'vocab',
            payload: { prompt: 'Nope', options: ['A', 'B'] },
            correctOptionIndex: 0,
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      replacePracticeItemsBodySchema.safeParse({
        items: [
          {
            kind: 'comprehension',
            payload: { prompt: 'Q', options: ['A', 'B'] },
            correctOptionIndex: 5,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires at least one attempt patch field', () => {
    expect(updatePracticeAttemptBodySchema.safeParse({}).success).toBe(false);
    expect(updatePracticeAttemptBodySchema.parse({ status: 'skipped' })).toEqual({ status: 'skipped' });
  });

  it('accepts AI generate response with one to five items', () => {
    const parsed = generatePracticeItemsResponseSchema.parse({
      items: [
        {
          kind: 'comprehension',
          payload: { prompt: 'What happened?', options: ['A', 'B', 'C'] },
          correctOptionIndex: 0,
        },
      ],
    });
    expect(parsed.items).toHaveLength(1);
    expect(generatePracticeItemsResponseSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
