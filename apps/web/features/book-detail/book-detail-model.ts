import type { ArticleLevel } from '@gloaming/shared/api/articles';
import type { ReadingProgressStatus } from '@gloaming/shared/api/reader';

import { LEVEL_LABEL } from '@/features/content/content-model';

/** Reading lifecycle for book detail CTA / progress chrome. */
export type BookReadingStatus = 'unread' | 'in_progress' | 'completed';

export type BookDetailShelfStatus = 'available' | 'on_shelf';

export type BookDetail = {
  id: string;
  title: string;
  level: ArticleLevel;
  themes: string[];
  estimatedMinutes: number | null;
  publishedAt: string | null;
  sourceNote: string;
  wordCount: number;
  teaser: string;
  sourceLabel: '官方';
  shelfStatus: BookDetailShelfStatus;
  readingStatus: BookReadingStatus;
  progressRatio: number | null;
  lastReadAt: string | null;
  completedAt: string | null;
};

export function primaryReadLabel(status: BookReadingStatus): string {
  if (status === 'in_progress') {
    return '继续阅读';
  }
  if (status === 'completed') {
    return '再次阅读';
  }
  return '开始阅读';
}

export function formatRelativeReadTime(iso: string | null, now = new Date()): string | null {
  if (!iso) {
    return null;
  }
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return null;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / dayMs);
  const time = then.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dayDiff === 0) {
    return `今天 ${time}`;
  }
  if (dayDiff === 1) {
    return `昨天 ${time}`;
  }
  return then.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

export function formatWordCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return String(count);
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null || minutes <= 0) {
    return '—';
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
  }
  return `${minutes} 分钟`;
}

export function levelMeta(level: ArticleLevel): string {
  return LEVEL_LABEL[level] ?? level;
}

/** Filled stars out of 5 — mirrors desktop detail prototype (not CEFR). */
export function levelStarCount(level: ArticleLevel): number {
  if (level === 'easy') {
    return 2;
  }
  if (level === 'stretch') {
    return 4;
  }
  return 3;
}

export function readingStatusFromProgress(
  status: ReadingProgressStatus | null,
  progressRatio: number | null,
): BookReadingStatus {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'in_progress' && progressRatio != null && progressRatio > 0) {
    return 'in_progress';
  }
  return 'unread';
}

export function teaserFromBody(body: string, sourceNote: string): string {
  const firstParagraph = body
    .trim()
    .split(/\n\s*\n/)[0]
    ?.trim();
  if (firstParagraph) {
    const clipped = firstParagraph.length > 180 ? `${firstParagraph.slice(0, 177)}…` : firstParagraph;
    return clipped;
  }
  const note = sourceNote.trim();
  if (note) {
    return note.length > 180 ? `${note.slice(0, 177)}…` : note;
  }
  return '';
}
