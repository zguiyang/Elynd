import { describe, expect, it } from 'vitest';

import { chaptersFromParts } from '@/features/book-detail/book-detail-api';
import {
  aboutParagraphsFromDescription,
  chapterOrdinalLabel,
  chapterStatusLabel,
  coverUrlFromAssetId,
  formatMinutes,
  formatRelativeReadTime,
  formatWordCount,
  languageLabelFromCode,
  levelMeta,
  levelStarCount,
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

  it('formats minutes and word counts for stats', () => {
    expect(formatMinutes(15)).toBe('15 分钟');
    expect(formatMinutes(90)).toBe('1 小时 30 分');
    expect(formatMinutes(450)).toBe('7 小时 30 分');
    expect(formatWordCount(3200)).toBe('3.2k');
    expect(formatWordCount(85000)).toBe('85k');
  });

  it('maps levels to labels and star counts', () => {
    expect(levelMeta('easy')).toBe('简单');
    expect(levelMeta('mid')).toBe('中等');
    expect(levelMeta('hard')).toBe('稍难');
    expect(levelStarCount('easy')).toBe(2);
    expect(levelStarCount('mid')).toBe(3);
    expect(levelStarCount('hard')).toBe(4);
  });

  it('derives reading status from shelf/reader state', () => {
    expect(readingStatusFromProgress('completed', 100)).toBe('completed');
    expect(readingStatusFromProgress('in_progress', 40)).toBe('in_progress');
    expect(readingStatusFromProgress('in_progress', 0)).toBe('unread');
    expect(readingStatusFromProgress(null, null)).toBe('unread');
  });

  it('builds teaser and about from description', () => {
    expect(teaserFromDescription('Short desc')).toBe('Short desc');
    expect(teaserFromDescription('')).toBe('');
    expect(aboutParagraphsFromDescription('A\n\nB')).toEqual(['A', 'B']);
    expect(aboutParagraphsFromDescription('')).toEqual([]);
  });

  it('maps language and cover asset URLs', () => {
    expect(languageLabelFromCode('en')).toBe('英文原版');
    expect(languageLabelFromCode('zh')).toBe('zh');
    expect(coverUrlFromAssetId('abc')).toBe('/api/assets/abc');
    expect(coverUrlFromAssetId(null)).toBeNull();
  });
  it('maps chapter status labels including unread', () => {
    expect(chapterStatusLabel('unread')).toBe('未读');
    expect(chapterStatusLabel('current')).toBe('正在阅读');
    expect(chapterStatusLabel('read')).toBe('已读');
  });

  it('formats Arabic chapter ordinals without zero-pad', () => {
    expect(chapterOrdinalLabel(1)).toBe('1');
    expect(chapterOrdinalLabel(2)).toBe('2');
    expect(chapterOrdinalLabel(11)).toBe('11');
    expect(chapterOrdinalLabel(21)).toBe('21');
  });
});

describe('chaptersFromParts', () => {
  const parts = [
    {
      id: 'p1',
      workId: 'w',
      sortOrder: 0,
      kind: 'chapter' as const,
      title: 'One',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'p2',
      workId: 'w',
      sortOrder: 1,
      kind: 'chapter' as const,
      title: 'Two',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'p3',
      workId: 'w',
      sortOrder: 2,
      kind: 'chapter' as const,
      title: 'Three',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('marks all unread without shelf state', () => {
    const chapters = chaptersFromParts(parts, null);
    expect(chapters.map((c) => c.status)).toEqual(['unread', 'unread', 'unread']);
    expect(chapters[0]?.estimatedMinutes).toBeNull();
  });

  it('marks current and prior chapters from shelf progress', () => {
    const chapters = chaptersFromParts(parts, {
      status: 'in_progress',
      currentPartId: 'p2',
      progressRatio: 40,
      lastReadAt: '2026-08-28T12:00:00.000Z',
      completedAt: null,
    });
    expect(chapters.map((c) => c.status)).toEqual(['read', 'current', 'unread']);
  });

  it('marks all read when completed', () => {
    const chapters = chaptersFromParts(parts, {
      status: 'completed',
      currentPartId: 'p3',
      progressRatio: 100,
      lastReadAt: '2026-08-28T12:00:00.000Z',
      completedAt: '2026-08-28T12:00:00.000Z',
    });
    expect(chapters.every((c) => c.status === 'read')).toBe(true);
  });
});
