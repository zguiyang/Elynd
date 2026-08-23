import type { ArticleLevel } from '@gloaming/shared/api/articles';

import { LEVEL_LABEL } from '@/features/content/content-model';

/** Reading lifecycle for book detail CTA / progress chrome (UI mock). */
export type BookReadingStatus = 'unread' | 'in_progress' | 'completed';

export type BookChapterStatus = 'read' | 'current' | 'unread';

export type BookChapter = {
  id: string;
  index: number;
  title: string;
  estimatedMinutes: number;
  wordCount: number;
  status: BookChapterStatus;
};

export type BookDetailShelfStatus = 'available' | 'on_shelf';

export type BookDetail = {
  id: string;
  title: string;
  author: string;
  level: ArticleLevel;
  category: string;
  themes: string[];
  estimatedMinutes: number;
  wordCount: number;
  /** Short hook under the title (serif italic). */
  teaser: string;
  /** Longer about paragraphs (reading serif). */
  about: string[];
  sourceLabel: '官方';
  languageLabel: string;
  shelfStatus: BookDetailShelfStatus;
  readingStatus: BookReadingStatus;
  progressRatio: number | null;
  lastReadAt: string | null;
  completedAt: string | null;
  chapters: BookChapter[];
  relatedIds: string[];
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

export function formatMinutes(minutes: number): string {
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

export function chapterStatusLabel(status: BookChapterStatus): string | null {
  if (status === 'read') {
    return '已读';
  }
  if (status === 'current') {
    return '当前阅读';
  }
  return null;
}
