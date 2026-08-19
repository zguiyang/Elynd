import { describe, expect, it } from 'vitest';

import {
  calendarDateInTimeZone,
  generateReviewItemsResponseSchema,
  replaceReviewItemsBodySchema,
  reviewAnswerBodySchema,
  reviewAnswerResponseSchema,
  reviewFeedbackResponseSchema,
  reviewTodayDataSchema,
} from './review.ts';

describe('review api contracts', () => {
  it('formats a Shanghai calendar date as YYYY-MM-DD', () => {
    expect(calendarDateInTimeZone(new Date('2026-08-18T18:30:00.000Z'))).toBe('2026-08-19');
  });

  it('accepts cloze and sense bank items', () => {
    const parsed = replaceReviewItemsBodySchema.parse({
      items: [
        {
          kind: 'cloze',
          sentence: 'The ocean is full of mysteries.',
          focus: 'mysteries',
          options: ['trenches', 'mysteries'],
          hintZh: '说不清的事。',
          correctOptionIndex: 1,
        },
        {
          kind: 'sense',
          sentence: 'A warm current carries nutrients.',
          focus: 'current',
          options: ['现在', '洋流'],
          hintZh: '洋流。',
          correctOptionIndex: 1,
          sortOrder: 2,
        },
      ],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects an out-of-range answer key', () => {
    expect(
      replaceReviewItemsBodySchema.safeParse({
        items: [
          {
            kind: 'cloze',
            sentence: 'Hello.',
            focus: 'Hello',
            options: ['A', 'B'],
            hintZh: '嗨。',
            correctOptionIndex: 2,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts generate drafts and today payload shapes', () => {
    expect(
      generateReviewItemsResponseSchema.parse({
        items: [
          {
            kind: 'cloze',
            sentence: 'Sunlight fades.',
            focus: 'Sunlight',
            options: ['月光', '阳光'],
            hintZh: '日光。',
            correctOptionIndex: 1,
          },
        ],
      }).items,
    ).toHaveLength(1);

    expect(
      reviewTodayDataSchema.parse({
        queueStatus: 'need_completion',
        date: '2026-08-19',
        outcome: null,
        items: [],
        result: null,
      }).queueStatus,
    ).toBe('need_completion');

    expect(reviewAnswerBodySchema.parse({ itemId: 'a', selectedIndex: 0 })).toEqual({
      itemId: 'a',
      selectedIndex: 0,
    });

    expect(
      reviewAnswerResponseSchema.parse({
        isHit: true,
        hint: null,
        correctIndex: 1,
        queueStatus: 'done',
        result: {
          correctCount: 1,
          totalCount: 1,
          items: [
            {
              id: 'item-1',
              kind: 'cloze',
              label: 'sea',
              sentence: 'Deep blue sea.',
              options: ['sky', 'sea'],
              selectedOptionIndex: 1,
              correctOptionIndex: 1,
              isCorrect: true,
            },
          ],
        },
      }).result?.correctCount,
    ).toBe(1);

    expect(reviewFeedbackResponseSchema.parse({ advice: '先回看错的那句就好。' }).advice.length).toBeGreaterThan(0);
    expect(reviewFeedbackResponseSchema.safeParse({ advice: '' }).success).toBe(false);
  });
});
