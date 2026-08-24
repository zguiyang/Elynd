import { describe, expect, it } from 'vitest';

import { pendingProgressFlushRatio, scrollProgressRatio } from '@/features/reader/reader-progress';

describe('scrollProgressRatio', () => {
  it('returns 100 when content fits without scrolling', () => {
    const el = { scrollTop: 0, scrollHeight: 400, clientHeight: 400 } as HTMLElement;
    expect(scrollProgressRatio(el)).toBe(100);
  });

  it('returns rounded scroll percentage', () => {
    const el = { scrollTop: 250, scrollHeight: 1000, clientHeight: 500 } as HTMLElement;
    expect(scrollProgressRatio(el)).toBe(50);
  });
});

describe('pendingProgressFlushRatio', () => {
  it('returns null when nothing pending or already sent', () => {
    expect(pendingProgressFlushRatio(null, 0)).toBeNull();
    expect(pendingProgressFlushRatio(40, 40)).toBeNull();
  });

  it('returns pending ratio when it differs from last sent', () => {
    expect(pendingProgressFlushRatio(55, 40)).toBe(55);
  });
});
