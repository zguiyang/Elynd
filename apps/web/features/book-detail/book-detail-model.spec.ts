import { describe, expect, it } from 'vitest';

import {
  formatMinutes,
  formatRelativeReadTime,
  formatWordCount,
  levelMeta,
  levelStarCount,
  primaryReadLabel,
} from '@/features/book-detail/book-detail-model';
import { LEVEL_LABEL } from '@/features/content/content-model';

describe('book-detail-model', () => {
  it('maps reading status to primary CTA labels', () => {
    expect(primaryReadLabel('unread')).toBe('开始阅读');
    expect(primaryReadLabel('in_progress')).toBe('继续阅读');
    expect(primaryReadLabel('completed')).toBe('再次阅读');
  });

  it('formats relative last-read times', () => {
    const now = new Date(2026, 7, 21, 10, 0, 0);
    const yesterday = new Date(2026, 7, 20, 20, 30, 0);
    expect(formatRelativeReadTime(yesterday.toISOString(), now)).toMatch(/^昨天/);
    expect(formatRelativeReadTime(null, now)).toBeNull();
  });

  it('formats minutes and word counts for stats', () => {
    expect(formatMinutes(15)).toBe('15 分钟');
    expect(formatMinutes(90)).toBe('1 小时 30 分');
    expect(formatWordCount(3200)).toBe('3.2k');
    expect(formatWordCount(85000)).toBe('85k');
  });

  it('reuses shared content level labels', () => {
    expect(levelMeta('easy')).toBe(LEVEL_LABEL.easy);
    expect(levelMeta('mid')).toBe(LEVEL_LABEL.mid);
  });

  it('maps levels to star counts for the difficulty meter', () => {
    expect(levelStarCount('easy')).toBe(2);
    expect(levelStarCount('mid')).toBe(3);
    expect(levelStarCount('stretch')).toBe(4);
  });
});
