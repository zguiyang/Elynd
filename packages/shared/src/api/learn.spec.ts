import { describe, expect, it } from 'vitest';

import {
  generatePracticeItemsResponseSchema,
  LEARN_TODAY_RECOMMENDATIONS_LIMIT,
  learnTodayDataSchema,
  practiceFeedbackResponseSchema,
  replacePracticeItemsBodySchema,
  updatePracticeAttemptBodySchema,
  updatePracticeAttemptResponseSchema,
  updateReadingProgressBodySchema,
} from './learn.ts';

describe('learn api contracts', () => {
  it('accepts today payload with up to three unread recommendations', () => {
    const parsed = learnTodayDataSchema.parse({
      current: null,
      continueReading: [],
      activePractice: null,
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
        activePractice: null,
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

  it('accepts completed attempt result shape', () => {
    const parsed = updatePracticeAttemptResponseSchema.parse({
      id: 'a1',
      articleId: 'art1',
      status: 'completed',
      currentIndex: 1,
      answers: [{ practiceItemId: 'i1', selectedOptionIndex: 0 }],
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      result: {
        correctCount: 1,
        totalCount: 1,
        items: [
          {
            practiceItemId: 'i1',
            kind: 'comprehension',
            label: 'Main idea?',
            options: ['A', 'B'],
            selectedOptionIndex: 0,
            correctOptionIndex: 0,
            isCorrect: true,
          },
        ],
      },
    });
    expect(parsed.result?.correctCount).toBe(1);
  });

  it('accepts practice feedback advice', () => {
    expect(practiceFeedbackResponseSchema.parse({ advice: '先回看错题里的那句就好。' }).advice.length).toBeGreaterThan(
      0,
    );
    expect(practiceFeedbackResponseSchema.safeParse({ advice: '' }).success).toBe(false);
  });
});
