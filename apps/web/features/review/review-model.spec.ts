import { describe, expect, it } from 'vitest';

import {
  checkLine,
  finishCopy,
  isSameDayGate,
  REVIEW_DAILY_CAP,
  REVIEW_STUB,
  reviewQueue,
  splitFocus,
  todayIso,
} from '@/features/review/review-model';

describe('reviewQueue', () => {
  it('caps at REVIEW_DAILY_CAP and does not pad', () => {
    expect(reviewQueue(REVIEW_STUB.items)).toHaveLength(REVIEW_DAILY_CAP);
    expect(reviewQueue(REVIEW_STUB.items.slice(0, 4))).toHaveLength(4);
  });
});

describe('splitFocus', () => {
  it('splits the focus word out of the sentence', () => {
    expect(splitFocus('A warm current carries nutrients across the basin.', 'current')).toEqual({
      before: 'A warm ',
      match: 'current',
      after: ' carries nutrients across the basin.',
    });
    expect(splitFocus('No match here.', 'current')).toBeNull();
  });
});

describe('checkLine', () => {
  const item = REVIEW_STUB.items[3];

  it('stays quiet on a hit and only contrasts on a miss', () => {
    expect(item).toBeDefined();
    if (!item) {
      return;
    }
    expect(checkLine(item, item.correctIndex)).toEqual({ isHit: true, line: null });
    expect(checkLine(item, 0)).toEqual({
      isHit: false,
      line: '是「洋流」，不是「现在」。',
    });
  });
});

describe('finishCopy', () => {
  it('picks three complete bands from miss count, not a score', () => {
    expect(finishCopy({ variant: 'complete', missCount: 0, total: 10 }).title).toBe('今天挺顺');
    expect(finishCopy({ variant: 'complete', missCount: 2, total: 10 }).title).toBe('有几句还不熟');
    expect(finishCopy({ variant: 'complete', missCount: 6, total: 10 }).title).toBe('这篇还早');
  });

  it('only mentions tomorrow after a full cap, not when the queue ran out', () => {
    expect(finishCopy({ variant: 'exhaust', missCount: 0, total: 4 }).sub).toBeNull();
    expect(finishCopy({ variant: 'complete', missCount: 0, total: 10 }).sub).toBe('明天再来。');
  });

  it('keeps early and capped copy short', () => {
    expect(finishCopy({ variant: 'early', missCount: 0, total: 10 })).toEqual({
      title: '先这样',
      sub: null,
    });
    expect(finishCopy({ variant: 'capped', missCount: 3, total: 10 })).toEqual({
      title: '今天够了',
      sub: '明天再来。',
    });
  });
});

describe('daily gate', () => {
  it('only matches the same local day', () => {
    const today = todayIso(new Date('2026-08-18T15:00:00'));
    expect(isSameDayGate(JSON.stringify({ day: today }), today)).toBe(true);
    expect(isSameDayGate(JSON.stringify({ day: '2026-08-17' }), today)).toBe(false);
    expect(isSameDayGate('nope', today)).toBe(false);
  });
});
