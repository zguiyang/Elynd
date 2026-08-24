import type { ReadingStateStatus } from '@gloaming/shared/api/reader';

/** Reading lifecycle for book detail CTA / progress chrome. */
export type BookReadingStatus = 'unread' | 'in_progress' | 'completed';

export type BookDetailShelfStatus = 'available' | 'on_shelf';

export type BookDetail = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string | null;
  sourceNote: string;
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

export function readingStatusFromProgress(
  status: ReadingStateStatus | null,
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

export function teaserFromDescription(description: string, sourceNote: string): string {
  const desc = description.trim();
  if (desc) {
    return desc.length > 180 ? `${desc.slice(0, 177)}…` : desc;
  }
  const note = sourceNote.trim();
  if (note) {
    return note.length > 180 ? `${note.slice(0, 177)}…` : note;
  }
  return '';
}
