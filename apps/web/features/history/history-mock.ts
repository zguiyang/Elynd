import type { ArticleLevel } from '@gloaming/shared/api/articles';
import type { ReadingProgressStatus } from '@gloaming/shared/api/learn';

/**
 * Reading-history UI prototype fixtures only — not wired to /api/progress.
 * Shape mirrors LearnTodayEntry + quiet summary fields so a future adapter
 * can map API rows without rewriting cards.
 */

export type HistoryWorkStatus = ReadingProgressStatus;

export type HistoryWork = {
  id: string;
  title: string;
  author: string;
  level: ArticleLevel;
  themes: string[];
  progressRatio: number;
  status: HistoryWorkStatus;
  lastReadAt: string;
  completedAt: string | null;
  /** Optional quiet meta for list rows (prototype display only). */
  minutesReadLabel: string | null;
  lookups: number | null;
};

export type HistoryActivityLevel = 0 | 1 | 2 | 3;

export type HistoryActivityDay = {
  date: string;
  level: HistoryActivityLevel;
};

export type HistoryEventKind = 'completed' | 'lookup' | 'resumed';

export type HistoryEvent = {
  id: string;
  at: string;
  kind: HistoryEventKind;
  title: string | null;
  lookupCount: number | null;
};

export type HistorySummary = {
  readingDays: number;
  durationLabel: string;
  textsRead: number;
  lookups: number;
};

export type HistoryRangeId = '7d' | '15d' | '30d' | '6m' | '1y' | '3m' | '2024' | '2023' | 'all';

export type HistoryData = {
  summary: HistorySummary;
  /** Days with reading presence for heatmap (YYYY-MM-DD). */
  activity: HistoryActivityDay[];
  /** Bar heights 0–100 for quiet trend strip (desktop). */
  trendHeights: number[];
  events: HistoryEvent[];
  works: HistoryWork[];
  readingDaysInWindow: number;
};

export const HISTORY_DESKTOP_RANGES = [
  { id: '7d' as const, label: '7天' },
  { id: '15d' as const, label: '15天' },
  { id: '30d' as const, label: '30天' },
  { id: '6m' as const, label: '6个月' },
  { id: '1y' as const, label: '1年' },
];

export const HISTORY_MOBILE_RANGES = [
  { id: '3m' as const, label: '最近 3 个月' },
  { id: '2024' as const, label: '2024' },
  { id: '2023' as const, label: '2023' },
  { id: 'all' as const, label: '全部' },
];

function buildMockActivity(): HistoryActivityDay[] {
  const days: HistoryActivityDay[] = [];
  const start = new Date(Date.UTC(2025, 0, 1));
  for (let i = 0; i < 366; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const date = `${y}-${m}-${day}`;
    const seed = (i * 17 + 3) % 11;
    let level: HistoryActivityLevel = 0;
    if (seed === 0 || seed === 1) {
      level = 0;
    } else if (seed <= 4) {
      level = 1;
    } else if (seed <= 7) {
      level = 2;
    } else {
      level = 3;
    }
    if (level > 0) {
      days.push({ date, level });
    }
  }
  return days;
}

const populatedWorks: HistoryWork[] = [
  {
    id: 'history-1',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    level: 'mid',
    themes: ['classic', 'society'],
    progressRatio: 100,
    status: 'completed',
    lastReadAt: '2026-08-12T10:00:00.000Z',
    completedAt: '2026-08-12T10:00:00.000Z',
    minutesReadLabel: '12h 45m',
    lookups: 156,
  },
  {
    id: 'history-2',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    level: 'stretch',
    themes: ['essay', 'thought'],
    progressRatio: 100,
    status: 'completed',
    lastReadAt: '2026-07-04T09:00:00.000Z',
    completedAt: '2026-07-04T09:00:00.000Z',
    minutesReadLabel: '8h 12m',
    lookups: 42,
  },
  {
    id: 'history-3',
    title: 'Siddhartha',
    author: 'Hermann Hesse',
    level: 'easy',
    themes: ['story'],
    progressRatio: 100,
    status: 'completed',
    lastReadAt: '2026-08-20T18:00:00.000Z',
    completedAt: '2026-08-20T18:00:00.000Z',
    minutesReadLabel: '6h 20m',
    lookups: 28,
  },
  {
    id: 'history-4',
    title: 'The Stranger',
    author: 'Albert Camus',
    level: 'mid',
    themes: ['classic'],
    progressRatio: 100,
    status: 'completed',
    lastReadAt: '2026-08-12T14:00:00.000Z',
    completedAt: '2026-08-12T14:00:00.000Z',
    minutesReadLabel: '5h 10m',
    lookups: 31,
  },
  {
    id: 'history-5',
    title: 'The Art of Noticing',
    author: 'Ellen Langer',
    level: 'mid',
    themes: ['essay', 'mindfulness'],
    progressRatio: 45,
    status: 'in_progress',
    lastReadAt: '2026-08-21T08:00:00.000Z',
    completedAt: null,
    minutesReadLabel: '2h 15m',
    lookups: 19,
  },
  {
    id: 'history-6',
    title: 'Walden',
    author: 'Henry David Thoreau',
    level: 'mid',
    themes: ['nature'],
    progressRatio: 18,
    status: 'in_progress',
    lastReadAt: '2026-08-18T16:00:00.000Z',
    completedAt: null,
    minutesReadLabel: '1h 05m',
    lookups: 11,
  },
];

export const HISTORY_MOCK_POPULATED: HistoryData = {
  summary: {
    readingDays: 142,
    durationLabel: '38h 24m',
    textsRead: 12,
    lookups: 1048,
  },
  activity: buildMockActivity(),
  trendHeights: [10, 20, 50, 15, 70, 5, 80, 30, 40, 60, 25, 10, 90, 45],
  readingDaysInWindow: 100,
  events: [
    {
      id: 'ev-1',
      at: '2026-08-20T18:00:00.000Z',
      kind: 'completed',
      title: 'Siddhartha',
      lookupCount: null,
    },
    {
      id: 'ev-2',
      at: '2026-08-12T14:00:00.000Z',
      kind: 'completed',
      title: 'The Stranger',
      lookupCount: null,
    },
    {
      id: 'ev-3',
      at: '2026-08-10T11:00:00.000Z',
      kind: 'lookup',
      title: null,
      lookupCount: 4,
    },
    {
      id: 'ev-4',
      at: '2026-08-21T08:00:00.000Z',
      kind: 'resumed',
      title: 'The Art of Noticing',
      lookupCount: null,
    },
  ],
  works: populatedWorks,
};

export const HISTORY_MOCK_EMPTY: HistoryData = {
  summary: {
    readingDays: 0,
    durationLabel: '0h',
    textsRead: 0,
    lookups: 0,
  },
  activity: [],
  trendHeights: [],
  readingDaysInWindow: 0,
  events: [],
  works: [],
};

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatHistoryEventWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startThat.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return '今天';
  }
  if (diffDays === 1) {
    return '昨天';
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
