/**
 * Book detail UI prototype fixtures only — not wired to catalog/progress APIs.
 * IDs align with Discover mock so Discover → Detail navigation works.
 */

import type { BookChapter, BookDetail, BookReadingStatus } from '@/features/book-detail/book-detail-model';
import { DISCOVER_MOCK_POPULATED, type DiscoverItem } from '@/features/discover/discover-mock';

type DetailEnrichment = {
  teaser: string;
  about: string[];
  wordCount: number;
  readingStatus: BookReadingStatus;
  progressRatio: number | null;
  lastReadAt: string | null;
  completedAt: string | null;
  shelfStatus: BookDetail['shelfStatus'];
  chapters: Omit<BookChapter, 'status'>[];
  /** Index (0-based) of current chapter when in_progress; ignored otherwise. */
  currentChapterIndex?: number;
  relatedIds: string[];
};

function withChapterStatus(
  chapters: Omit<BookChapter, 'status'>[],
  readingStatus: BookReadingStatus,
  currentChapterIndex = 0,
): BookChapter[] {
  if (readingStatus === 'unread') {
    return chapters.map((ch) => ({ ...ch, status: 'unread' as const }));
  }
  if (readingStatus === 'completed') {
    return chapters.map((ch) => ({ ...ch, status: 'read' as const }));
  }
  return chapters.map((ch, i) => {
    if (i < currentChapterIndex) {
      return { ...ch, status: 'read' as const };
    }
    if (i === currentChapterIndex) {
      return { ...ch, status: 'current' as const };
    }
    return { ...ch, status: 'unread' as const };
  });
}

const DEFAULT_CHAPTERS: Omit<BookChapter, 'status'>[] = [
  { id: 'ch-1', index: 1, title: 'I. The Opening', estimatedMinutes: 4, wordCount: 620 },
  { id: 'ch-2', index: 2, title: 'II. The Quiet Road', estimatedMinutes: 5, wordCount: 780 },
  { id: 'ch-3', index: 3, title: 'III. A Turning Point', estimatedMinutes: 4, wordCount: 640 },
  { id: 'ch-4', index: 4, title: 'IV. The Return', estimatedMinutes: 3, wordCount: 510 },
];

function defaultEnrichment(item: DiscoverItem): DetailEnrichment {
  const relatedIds = DISCOVER_MOCK_POPULATED.items
    .filter((row) => row.id !== item.id)
    .slice(0, 4)
    .map((row) => row.id);

  let readingStatus: BookReadingStatus = 'unread';
  let progressRatio: number | null = null;
  let lastReadAt: string | null = null;
  const completedAt: string | null = null;
  let shelfStatus: BookDetail['shelfStatus'] =
    item.shelfStatus === 'on_shelf' || item.shelfStatus === 'in_progress' ? 'on_shelf' : 'available';
  let currentChapterIndex = 0;

  if (item.shelfStatus === 'in_progress' || (item.progressRatio != null && item.progressRatio > 0)) {
    readingStatus = 'in_progress';
    progressRatio = item.progressRatio ?? 35;
    lastReadAt = '2026-08-20T20:30:00.000Z';
    currentChapterIndex = 2;
    shelfStatus = 'on_shelf';
  }

  const minutes = item.estimatedMinutes ?? 12;
  const wordCount = Math.round(minutes * 220);

  return {
    teaser: item.description,
    about: [
      item.description,
      'The prose stays close to authentic English rhythm—clear enough for sustained reading, rich enough that looking up a phrase feels like a natural pause rather than a drill.',
      'Open the text when you are ready. Help, if you need it, waits inside the reader—not on this page.',
    ],
    wordCount,
    readingStatus,
    progressRatio,
    lastReadAt,
    completedAt,
    shelfStatus,
    chapters: DEFAULT_CHAPTERS.map((ch, i) => ({
      ...ch,
      id: `${item.id}-${ch.id}`,
      estimatedMinutes: Math.max(2, Math.round(minutes / DEFAULT_CHAPTERS.length) + (i % 2)),
      wordCount: Math.round(wordCount / DEFAULT_CHAPTERS.length) + i * 40,
    })),
    currentChapterIndex,
    relatedIds,
  };
}

/** Per-id overrides for the three required reading states (+ shelf). */
const ENRICHMENTS: Partial<Record<string, Partial<DetailEnrichment>>> = {
  // State 1 — unread
  'discover-1': {
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    shelfStatus: 'available',
    teaser:
      'An exploration of how modern digital infrastructure is reshaping our physical environments, blending the ethereal qualities of the cloud with tangible concrete and steel.',
    about: [
      'An exploration of how modern digital infrastructure is reshaping our physical environments, blending the ethereal qualities of the cloud with tangible concrete and steel.',
      'Jenkins writes with a surveyor’s patience: streets, servers, and the soft pressure of systems we rarely see. The essay rewards a slow afternoon more than a skim.',
      'Read it as you would a long magazine piece—then keep going when a sentence sticks. Assistance stays inside the reader.',
    ],
    chapters: [
      { id: 'discover-1-ch-1', index: 1, title: 'I. Glass and Concrete', estimatedMinutes: 4, wordCount: 880 },
      { id: 'discover-1-ch-2', index: 2, title: 'II. The Soft Cloud', estimatedMinutes: 5, wordCount: 1020 },
      { id: 'discover-1-ch-3', index: 3, title: 'III. Streets That Listen', estimatedMinutes: 3, wordCount: 710 },
      { id: 'discover-1-ch-4', index: 4, title: 'IV. After the Blueprint', estimatedMinutes: 2, wordCount: 540 },
    ],
  },
  // State 2 — in progress (desktop prototype: progress bar + mixed TOC states)
  'discover-11': {
    readingStatus: 'in_progress',
    progressRatio: 42,
    lastReadAt: '2026-08-20T20:30:00.000Z',
    completedAt: null,
    shelfStatus: 'on_shelf',
    currentChapterIndex: 2,
    teaser:
      'A collection of essays unraveling the etymological threads that connect distant cultures through shared roots.',
    about: [
      'A collection of essays unraveling the etymological threads that connect distant cultures through shared roots.',
      'Thorne moves between dictionaries and dinner tables, showing how a single syllable can travel farther than an empire.',
      'This is patient reading—short chapters, long aftertaste. Continue where you left off; no quiz waits at the end.',
    ],
    chapters: [
      { id: 'discover-11-ch-1', index: 1, title: 'I. The Bowling Green', estimatedMinutes: 15, wordCount: 2400 },
      { id: 'discover-11-ch-2', index: 2, title: 'II. The Cloisters', estimatedMinutes: 20, wordCount: 3100 },
      { id: 'discover-11-ch-3', index: 3, title: 'III. The "Three Cups"', estimatedMinutes: 18, wordCount: 2800 },
      { id: 'discover-11-ch-4', index: 4, title: 'IV. The Flight', estimatedMinutes: 22, wordCount: 3500 },
      { id: 'discover-11-ch-5', index: 5, title: 'V. The Open Road', estimatedMinutes: 19, wordCount: 2900 },
    ],
  },
  // State 3 — completed
  'discover-2': {
    readingStatus: 'completed',
    progressRatio: 100,
    lastReadAt: '2026-08-18T21:10:00.000Z',
    completedAt: '2026-08-18T21:10:00.000Z',
    shelfStatus: 'on_shelf',
    teaser:
      'A haunting collection of short stories detailing the quiet moments of transition in a city that refuses to let go of its past.',
    about: [
      'A haunting collection of short stories detailing the quiet moments of transition in a city that refuses to let go of its past, told through the eyes of its oldest residents.',
      'Chen’s sentences linger in courtyards and bus stops. You finish not with a certificate, but with a street you want to walk again.',
      'When you are ready, open it once more—same text, new quiet.',
    ],
    chapters: [
      { id: 'discover-2-ch-1', index: 1, title: 'I. The Old Gate', estimatedMinutes: 3, wordCount: 580 },
      { id: 'discover-2-ch-2', index: 2, title: 'II. Rain on Stone', estimatedMinutes: 3, wordCount: 610 },
      { id: 'discover-2-ch-3', index: 3, title: 'III. Voices at Dusk', estimatedMinutes: 3, wordCount: 590 },
      { id: 'discover-2-ch-4', index: 4, title: 'IV. What Remains', estimatedMinutes: 2, wordCount: 470 },
    ],
  },
};

function mergeDetail(item: DiscoverItem): BookDetail {
  const base = defaultEnrichment(item);
  const override = ENRICHMENTS[item.id] ?? {};
  const merged: DetailEnrichment = {
    ...base,
    ...override,
    chapters: override.chapters ?? base.chapters,
    relatedIds: override.relatedIds ?? base.relatedIds,
  };

  return {
    id: item.id,
    title: item.title,
    author: item.author,
    level: item.level,
    category: item.category,
    themes: item.themes,
    estimatedMinutes: item.estimatedMinutes ?? 12,
    wordCount: merged.wordCount,
    teaser: merged.teaser,
    about: merged.about,
    sourceLabel: '官方',
    languageLabel: '英文原版',
    shelfStatus: merged.shelfStatus,
    readingStatus: merged.readingStatus,
    progressRatio: merged.progressRatio,
    lastReadAt: merged.lastReadAt,
    completedAt: merged.completedAt,
    chapters: withChapterStatus(merged.chapters, merged.readingStatus, merged.currentChapterIndex ?? 0),
    relatedIds: merged.relatedIds,
  };
}

const DETAIL_BY_ID: Record<string, BookDetail> = Object.fromEntries(
  DISCOVER_MOCK_POPULATED.items.map((item) => [item.id, mergeDetail(item)]),
);

export function getBookDetail(id: string): BookDetail | null {
  return DETAIL_BY_ID[id] ?? null;
}

export function getRelatedBooks(detail: BookDetail): BookDetail[] {
  return detail.relatedIds.map((id) => DETAIL_BY_ID[id]).filter((row): row is BookDetail => row != null);
}

/** Suggestions for the unavailable / load-failure empty state. */
export function getUnavailableSuggestions(limit = 4): BookDetail[] {
  return Object.values(DETAIL_BY_ID).slice(0, limit);
}

/** Demo ids for reading + unavailable states (prototype note). */
export const BOOK_DETAIL_DEMO_IDS = {
  unread: 'discover-1',
  inProgress: 'discover-11',
  completed: 'discover-2',
  unavailable: 'unavailable',
} as const;
