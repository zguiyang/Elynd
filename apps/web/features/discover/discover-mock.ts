import type { ArticleLevel } from '@gloaming/shared/api/articles';

/**
 * Discover UI prototype fixtures only — not wired to catalog/shelf APIs.
 * Shape mirrors ReaderItemSummary + discover presentation fields so a future
 * adapter can map API rows without rewriting cards.
 */

export const DISCOVER_CATEGORIES = ['全部', '小说', '散文', '新闻', '寓言故事', '科普', '教材资料'] as const;

export const DISCOVER_TAGS = ['全部', '藏书故事', '自然', '城市', '人文', '科技', '思想'] as const;

export const DISCOVER_SORT_OPTIONS = [
  { value: 'newest', label: '最新发布' },
  { value: 'shortest', label: '阅读时长' },
  { value: 'level', label: '难度' },
] as const;

export type DiscoverCategory = (typeof DISCOVER_CATEGORIES)[number];
export type DiscoverTag = (typeof DISCOVER_TAGS)[number];
export type DiscoverSortValue = (typeof DISCOVER_SORT_OPTIONS)[number]['value'];

/** Catalog membership relative to the reader's shelf (UI only). */
export type DiscoverShelfStatus = 'available' | 'on_shelf' | 'in_progress';

export type DiscoverItem = {
  id: string;
  title: string;
  author: string;
  level: ArticleLevel;
  category: Exclude<DiscoverCategory, '全部'>;
  themes: string[];
  estimatedMinutes: number | null;
  description: string;
  source: string;
  shelfStatus: DiscoverShelfStatus;
  progressRatio: number | null;
  /** ISO date for mock sort — replace with publishedAt from API later. */
  publishedAt: string;
};

export type DiscoverCatalogData = {
  items: DiscoverItem[];
};

const populatedItems: DiscoverItem[] = [
  {
    id: 'discover-1',
    title: 'The Architecture of Tomorrow',
    author: 'Sarah Jenkins',
    level: 'mid',
    category: '散文',
    themes: ['科技', '思想'],
    estimatedMinutes: 14,
    description:
      'An exploration of how modern digital infrastructure is reshaping our physical environments, blending the ethereal qualities of the cloud with tangible concrete and steel.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 'discover-2',
    title: 'Whispers of the Old City',
    author: 'David Chen',
    level: 'easy',
    category: '小说',
    themes: ['城市', '人文'],
    estimatedMinutes: 11,
    description:
      'A haunting collection of short stories detailing the quiet moments of transition in a city that refuses to let go of its past, told through the eyes of its oldest residents.',
    source: 'official',
    shelfStatus: 'on_shelf',
    progressRatio: null,
    publishedAt: '2026-08-19T09:00:00.000Z',
  },
  {
    id: 'discover-3',
    title: 'The Art of Stillness',
    author: 'Elena Rostova',
    level: 'mid',
    category: '散文',
    themes: ['思想'],
    estimatedMinutes: 12,
    description:
      'In an age of constant motion, this essay examines the profound necessity of pausing. Drawing from classical philosophy and modern psychology, it argues for the deliberate cultivation of silence.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-18T14:00:00.000Z',
  },
  {
    id: 'discover-4',
    title: 'Roots and Canopies',
    author: 'Thomas Birch',
    level: 'stretch',
    category: '科普',
    themes: ['自然', '科技'],
    estimatedMinutes: 16,
    description:
      'Discover the hidden networks beneath our feet and the towering ecosystems above. A deep dive into the resilient life of ancient forests and what they teach us about survival.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-17T11:00:00.000Z',
  },
  {
    id: 'discover-5',
    title: 'Echoes of the Vanguard',
    author: 'Maria Santos',
    level: 'mid',
    category: '新闻',
    themes: ['人文', '城市'],
    estimatedMinutes: 9,
    description:
      'A retrospective journalism piece covering the underground art movements of the late 20th century, capturing the raw energy of creators who defied convention.',
    source: 'official',
    shelfStatus: 'on_shelf',
    progressRatio: null,
    publishedAt: '2026-08-16T08:00:00.000Z',
  },
  {
    id: 'discover-6',
    title: 'Dust and Pages',
    author: 'Arthur Penhaligon',
    level: 'easy',
    category: '散文',
    themes: ['藏书故事', '人文'],
    estimatedMinutes: 10,
    description:
      'Memoirs of an antique book dealer. Travel through old European markets and dusty attics in pursuit of forgotten manuscripts and the stories they hold.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-15T16:00:00.000Z',
  },
  {
    id: 'discover-7',
    title: "The Clockmaker's Daughter",
    author: 'Linnea Sterling',
    level: 'easy',
    category: '寓言故事',
    themes: ['思想'],
    estimatedMinutes: 8,
    description:
      'A modern fable about time, patience, and the intricate mechanics of the heart, set in a village where every clock runs exactly five minutes late.',
    source: 'official',
    shelfStatus: 'on_shelf',
    progressRatio: null,
    publishedAt: '2026-08-14T12:00:00.000Z',
  },
  {
    id: 'discover-8',
    title: 'Elements of Syntax',
    author: 'Robert Channing',
    level: 'stretch',
    category: '教材资料',
    themes: ['思想', '科技'],
    estimatedMinutes: 18,
    description:
      'A foundational text demystifying the structural rules of language. Essential reading for linguistics students and passionate writers aiming to master prose.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-13T10:00:00.000Z',
  },
  {
    id: 'discover-9',
    title: 'Concrete Horizons',
    author: 'Julian Vance',
    level: 'mid',
    category: '散文',
    themes: ['城市', '自然'],
    estimatedMinutes: 13,
    description:
      'Walking the periphery of mega-cities, Vance observes the collision of urban sprawl and natural landscapes, finding poetry in the industrial decay.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-12T09:00:00.000Z',
  },
  {
    id: 'discover-10',
    title: 'A Quiet Journey',
    author: 'Elena Rossi',
    level: 'easy',
    category: '小说',
    themes: ['人文'],
    estimatedMinutes: 15,
    description:
      'An introspective novel exploring the delicate balance between memory and ambition along a slow coastal railway.',
    source: 'official',
    shelfStatus: 'available',
    progressRatio: null,
    publishedAt: '2026-08-11T15:00:00.000Z',
  },
  {
    id: 'discover-11',
    title: 'Roots of Language',
    author: 'Dr. Julian Thorne',
    level: 'mid',
    category: '散文',
    themes: ['思想', '人文'],
    estimatedMinutes: 12,
    description:
      'A collection of essays unraveling the etymological threads that connect distant cultures through shared roots.',
    source: 'official',
    shelfStatus: 'in_progress',
    progressRatio: 42,
    publishedAt: '2026-08-10T13:00:00.000Z',
  },
  {
    id: 'discover-12',
    title: 'Fragments of Dawn',
    author: 'Linnea Vinter',
    level: 'easy',
    category: '小说',
    themes: ['自然', '思想'],
    estimatedMinutes: 7,
    description:
      'Short, impactful verses and vignettes that play on nuanced meanings and the first light of ordinary days.',
    source: 'official',
    shelfStatus: 'on_shelf',
    progressRatio: null,
    publishedAt: '2026-08-09T11:00:00.000Z',
  },
];

export const DISCOVER_MOCK_POPULATED: DiscoverCatalogData = {
  items: populatedItems,
};

export const DISCOVER_MOCK_EMPTY: DiscoverCatalogData = {
  items: [],
};

export const DISCOVER_PAGE_SIZE = 9;

const LEVEL_RANK: Record<ArticleLevel, number> = {
  easy: 0,
  mid: 1,
  stretch: 2,
};

export function filterDiscoverItems(
  items: DiscoverItem[],
  category: DiscoverCategory,
  tag: DiscoverTag,
): DiscoverItem[] {
  return items.filter((item) => {
    const isCategoryMatch = category === '全部' || item.category === category;
    const isTagMatch = tag === '全部' || item.themes.includes(tag);
    return isCategoryMatch && isTagMatch;
  });
}

export function sortDiscoverItems(items: DiscoverItem[], sort: DiscoverSortValue): DiscoverItem[] {
  const next = [...items];
  if (sort === 'shortest') {
    next.sort((a, b) => (a.estimatedMinutes ?? 999) - (b.estimatedMinutes ?? 999));
    return next;
  }
  if (sort === 'level') {
    next.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
    return next;
  }
  next.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return next;
}
