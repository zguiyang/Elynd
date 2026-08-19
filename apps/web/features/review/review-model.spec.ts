import { describe, expect, it } from 'vitest';

import { finishCopy, splitFocus } from '@/features/review/review-model';

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
