/**
 * Book detail UI prototype fixtures — Mock UI phase (step 1).
 * Real catalog/shelf/parts wiring deferred to step 2.
 */

import type { BookChapter, BookDetail, BookReadingStatus } from '@/features/book-detail/book-detail-model';

/** Demo ids for reading + unavailable states (prototype note). */
export const BOOK_DETAIL_DEMO_IDS = {
  unread: 'mock-unread',
  inProgress: 'mock-in-progress',
  completed: 'mock-completed',
  unavailable: 'unavailable',
} as const;

const DEMO_ID_SET = new Set<string>(Object.values(BOOK_DETAIL_DEMO_IDS));

export function isBookDetailDemoId(workId: string): boolean {
  return DEMO_ID_SET.has(workId) || workId.startsWith('mock-');
}

type ChapterSeed = Omit<BookChapter, 'status'>;

function withChapterStatus(
  chapters: ChapterSeed[],
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

/** Cover art URLs from temp Stitch prototypes (mock only). */
const COVER = {
  spur: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCc23UF5XMu7NEwsKmLwyBslmOs0JH1dpOABa11V0HycSKkof1meMvVGQ4yaPrAPa0eHwXrmMvXeC_J2Qu-5UhaVgoaoJ2VLro7nwmLk_ojXzk_gq-Fens2LiiFDJAsFN8pUZlTFY3lziJbKtMiYlUrdO9xLdIiaWFWfcaa80NAR6K7d3qO5fxFLE51SlADRUsiLOnFHA-mfe6EbHuDh9t9P5M797J9s00ZvWfU2LPJVdGxzXy3y2vW7g',
  cities:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDHs2XtsMrSBqdSObPNan0c_V_dfCTJBEb6qF8iP_eQ2ZWXeRoI5DOxKbAb2cSpPHTaN0_9SSi1nVzlKbzIqGMfNNS_BQMzXWw1X-NN26oXjEGDmY6uM-XWGRl4btdqIjNCcE3UUXNumipiJwe5tcCKm1gUBSSlPWJblfCEg1zk8lEEor3OknVNTspj8dTWDn84xkEuZxNteYrom9ALPic2qRM4mlgITvS9kSITyy7iG2UV6emeINfA6A',
  treasure:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC0M5_k-vMEjWZ3nkmPKuu4jN3EFTznd-mh6vXcD4WmVt1dqR0Aot-Ve0kpNMBpALN6jYCcw_AOhCUw8uVOMWCLs16YMXGXhBOLEMD3fDf0eGw8fvVbUkdlZtSiS0fsEOf_8Z0MZwF-n3QfmN0ClbtqLossWAddgxmESRhuran389PaKK6vjCN0gPpI-Otx9o_Ozlnba5xxy983myO8Upc_a1Hok26X8Oyuthmqc8GrNocV95zNIKPxZA',
  pimpernel:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDpFQf5wud4rpgsyzuD459EhtUzBOy60NwVw2dD3wdt56c1rKtB2znIp_FaTvsM4O-u-oslmOfVC4eE8leQy5NlDeWk8P6vVHlOSP1_wRVlPLbaM9O8hrs_gDBXR9OMZ2MrXWmA9TmBSx1ALnXN3yaOheDtQiolxvs7prZPlCxGMfX7vpmr7_YEaH_wcvob3nsnYw4IAAWrZatBTUmdWIY2LpTNpnchyMSfmaf4SkffOSzQf_OMQ3ICCw',
  ivanhoe:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAF87b85jXxoVIvKcHo95aW7dtwEoctLbEqlaeGZwTGSdfi_yEgvjOJQ-lP5aKXlK57dVzvcXEHQuVSFE5i3CrHS49K-QE0JWt-xHaUrDNH_81LlP-bdy9_eMHAwu0ZVbvK7xVNpbn0QDSkVRmV0Wie1DxezlRKiAHqyVUSculgHvU1ql-b9suupBEiUOGo1E1so62woqJt5BzmEKX51dC5Fiwyr3HIC47NNpORdhBc_PPHP7xJWoxwCg',
} as const;

type BookSeed = Omit<BookDetail, 'chapters' | 'relatedIds'> & {
  chapterSeeds: ChapterSeed[];
  currentChapterIndex?: number;
  relatedIds: string[];
};

function buildBook(seed: BookSeed): BookDetail {
  const { chapterSeeds, currentChapterIndex = 0, ...rest } = seed;
  return {
    ...rest,
    chapters: withChapterStatus(chapterSeeds, seed.readingStatus, currentChapterIndex),
    relatedIds: seed.relatedIds,
  };
}

const CATALOG: BookDetail[] = [
  buildBook({
    id: BOOK_DETAIL_DEMO_IDS.inProgress,
    title: 'The Splendid Spur',
    author: 'Arthur Quiller-Couch',
    level: 'mid',
    cefrLabel: 'CEFR B2',
    category: '冒险故事',
    tags: ['历史小说 (Historical Fiction)', '冒险 (Adventure)', '经典 (Classic)'],
    estimatedMinutes: 450,
    wordCount: 85_000,
    teaser:
      'Being Memoirs of the Adventures of Mr. John Marvel, a Servant of His Late Majesty King Charles I., in the years 1642-3: written by himself, and edited in Modern English by "Q".',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: COVER.spur,
    shelfStatus: 'on_shelf',
    readingStatus: 'in_progress',
    progressRatio: 42,
    lastReadAt: '2026-08-28T20:30:00.000Z',
    completedAt: null,
    currentChapterIndex: 2,
    chapterSeeds: [
      { id: 'spur-ch-1', index: 1, title: 'I. The Bowling Green', estimatedMinutes: 15, wordCount: 2400 },
      { id: 'spur-ch-2', index: 2, title: 'II. The Cloisters', estimatedMinutes: 20, wordCount: 3100 },
      { id: 'spur-ch-3', index: 3, title: 'III. The "Three Cups"', estimatedMinutes: 18, wordCount: 2800 },
      { id: 'spur-ch-4', index: 4, title: 'IV. The Flight', estimatedMinutes: 22, wordCount: 3500 },
      { id: 'spur-ch-5', index: 5, title: 'V. The Open Road', estimatedMinutes: 19, wordCount: 2900 },
    ],
    relatedIds: ['mock-related-1', 'mock-related-2', 'mock-related-3', 'mock-related-4'],
  }),
  buildBook({
    id: BOOK_DETAIL_DEMO_IDS.unread,
    title: 'Glass and Concrete',
    author: 'Elena Jenkins',
    level: 'easy',
    cefrLabel: 'CEFR B1',
    category: '随笔',
    tags: ['城市 (Urban)', '科技 (Technology)', '随笔 (Essay)'],
    estimatedMinutes: 14,
    wordCount: 3200,
    teaser:
      'An exploration of how modern digital infrastructure is reshaping our physical environments, blending the ethereal qualities of the cloud with tangible concrete and steel.',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: null,
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapterSeeds: [
      { id: 'unread-ch-1', index: 1, title: 'I. Glass and Concrete', estimatedMinutes: 4, wordCount: 880 },
      { id: 'unread-ch-2', index: 2, title: 'II. The Soft Cloud', estimatedMinutes: 5, wordCount: 1020 },
      { id: 'unread-ch-3', index: 3, title: 'III. Streets That Listen', estimatedMinutes: 3, wordCount: 710 },
      { id: 'unread-ch-4', index: 4, title: 'IV. After the Blueprint', estimatedMinutes: 2, wordCount: 540 },
    ],
    relatedIds: [BOOK_DETAIL_DEMO_IDS.inProgress, 'mock-related-1', 'mock-related-2', BOOK_DETAIL_DEMO_IDS.completed],
  }),
  buildBook({
    id: BOOK_DETAIL_DEMO_IDS.completed,
    title: 'What Remains',
    author: 'Mei Chen',
    level: 'mid',
    cefrLabel: null,
    category: '短篇',
    tags: ['城市 (Urban)', '记忆 (Memory)', '短篇 (Short fiction)'],
    estimatedMinutes: 11,
    wordCount: 2400,
    teaser:
      'A haunting collection of short stories detailing the quiet moments of transition in a city that refuses to let go of its past.',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: null,
    shelfStatus: 'on_shelf',
    readingStatus: 'completed',
    progressRatio: 100,
    lastReadAt: '2026-08-27T21:10:00.000Z',
    completedAt: '2026-08-27T21:10:00.000Z',
    chapterSeeds: [
      { id: 'done-ch-1', index: 1, title: 'I. The Old Gate', estimatedMinutes: 3, wordCount: 580 },
      { id: 'done-ch-2', index: 2, title: 'II. Rain on Stone', estimatedMinutes: 3, wordCount: 610 },
      { id: 'done-ch-3', index: 3, title: 'III. Voices at Dusk', estimatedMinutes: 3, wordCount: 590 },
      { id: 'done-ch-4', index: 4, title: 'IV. What Remains', estimatedMinutes: 2, wordCount: 470 },
    ],
    relatedIds: [BOOK_DETAIL_DEMO_IDS.inProgress, 'mock-related-2', 'mock-related-3', BOOK_DETAIL_DEMO_IDS.unread],
  }),
  buildBook({
    id: 'mock-related-1',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    level: 'mid',
    cefrLabel: 'CEFR B2',
    category: '经典',
    tags: ['经典 (Classic)', '历史 (History)'],
    estimatedMinutes: 720,
    wordCount: 135_000,
    teaser: 'It was the best of times, it was the worst of times…',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: COVER.cities,
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapterSeeds: [
      { id: 'cities-ch-1', index: 1, title: 'I. Recalled to Life', estimatedMinutes: 25, wordCount: 4200 },
      { id: 'cities-ch-2', index: 2, title: 'II. The Golden Thread', estimatedMinutes: 30, wordCount: 5100 },
    ],
    relatedIds: [],
  }),
  buildBook({
    id: 'mock-related-2',
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    level: 'easy',
    cefrLabel: 'CEFR B1',
    category: '冒险',
    tags: ['冒险 (Adventure)'],
    estimatedMinutes: 360,
    wordCount: 68_000,
    teaser: "Fifteen men on the dead man's chest…",
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: COVER.treasure,
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapterSeeds: [
      { id: 'treasure-ch-1', index: 1, title: 'I. The Old Sea-dog', estimatedMinutes: 18, wordCount: 2900 },
    ],
    relatedIds: [],
  }),
  buildBook({
    id: 'mock-related-3',
    title: 'The Scarlet Pimpernel',
    author: 'Baroness Orczy',
    level: 'mid',
    cefrLabel: 'CEFR B2',
    category: '冒险',
    tags: ['冒险 (Adventure)', '历史 (History)'],
    estimatedMinutes: 540,
    wordCount: 92_000,
    teaser: 'They seek him here, they seek him there…',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: COVER.pimpernel,
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapterSeeds: [{ id: 'pimpernel-ch-1', index: 1, title: 'I. The League', estimatedMinutes: 20, wordCount: 3300 }],
    relatedIds: [],
  }),
  buildBook({
    id: 'mock-related-4',
    title: 'Ivanhoe',
    author: 'Walter Scott',
    level: 'hard',
    cefrLabel: 'CEFR C1',
    category: '经典',
    tags: ['经典 (Classic)', '骑士 (Chivalry)'],
    estimatedMinutes: 1080,
    wordCount: 180_000,
    teaser: 'A tale of chivalry in medieval England.',
    sourceLabel: '官方',
    languageLabel: '英文原版',
    coverImageUrl: COVER.ivanhoe,
    shelfStatus: 'available',
    readingStatus: 'unread',
    progressRatio: null,
    lastReadAt: null,
    completedAt: null,
    chapterSeeds: [
      { id: 'ivanhoe-ch-1', index: 1, title: 'I. The Hall of Cedric', estimatedMinutes: 28, wordCount: 4800 },
    ],
    relatedIds: [],
  }),
];

const DETAIL_BY_ID: Record<string, BookDetail> = Object.fromEntries(CATALOG.map((book) => [book.id, book]));

export function getBookDetail(id: string): BookDetail | null {
  return DETAIL_BY_ID[id] ?? null;
}

/**
 * Resolve detail for a route id. Unknown catalog UUIDs show the in-progress
 * showcase so any `/discover/[workId]` can review full Mock UI.
 */
export function resolveBookDetail(routeId: string): BookDetail | null {
  if (routeId === BOOK_DETAIL_DEMO_IDS.unavailable) {
    return null;
  }
  const known = getBookDetail(routeId);
  if (known) {
    return known;
  }
  const showcase = DETAIL_BY_ID[BOOK_DETAIL_DEMO_IDS.inProgress];
  return { ...showcase, id: routeId };
}

export function getRelatedBooks(detail: BookDetail): BookDetail[] {
  return detail.relatedIds.map((id) => DETAIL_BY_ID[id]).filter((row): row is BookDetail => row != null);
}

/** Suggestions for the unavailable / load-failure empty state. */
export function getUnavailableSuggestions(limit = 4): BookDetail[] {
  return [
    DETAIL_BY_ID[BOOK_DETAIL_DEMO_IDS.inProgress],
    DETAIL_BY_ID['mock-related-1'],
    DETAIL_BY_ID['mock-related-2'],
    DETAIL_BY_ID['mock-related-3'],
  ]
    .filter((row): row is BookDetail => row != null)
    .slice(0, limit);
}
