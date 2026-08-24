import type { ArticleLevel } from '@gloaming/shared/api/articles';

/** Catalog membership relative to the reader's shelf. */
export type DiscoverShelfStatus = 'available' | 'on_shelf' | 'in_progress';

export type DiscoverItem = {
  id: string;
  title: string;
  level: ArticleLevel;
  themes: string[];
  estimatedMinutes: number | null;
  publishedAt: string;
  shelfStatus: DiscoverShelfStatus;
  progressRatio: number | null;
  sourceLabel: '官方';
};

export const DISCOVER_PAGE_SIZE = 9;

export const DISCOVER_ALL_THEME = '全部' as const;
export type DiscoverThemeFilter = typeof DISCOVER_ALL_THEME | string;
