import { describe, expect, it } from 'vitest';

import {
  formatRelativeReadTime,
  primaryReadLabel,
  readingStatusFromProgress,
  teaserFromDescription,
} from '@/features/book-detail/book-detail-model';

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

  it('derives reading status from state', () => {
    expect(readingStatusFromProgress('completed', 100)).toBe('completed');
    expect(readingStatusFromProgress('in_progress', 40)).toBe('in_progress');
    expect(readingStatusFromProgress('in_progress', 0)).toBe('unread');
    expect(readingStatusFromProgress(null, null)).toBe('unread');
  });

  it('builds teaser from description or source note', () => {
    expect(teaserFromDescription('Short desc', '')).toBe('Short desc');
    expect(teaserFromDescription('', 'From demo seed')).toBe('From demo seed');
  });
});
