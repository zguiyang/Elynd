/** Catalog membership relative to the reader's shelf. */
export type DiscoverShelfStatus = 'available' | 'on_shelf' | 'in_progress';

export type DiscoverItem = {
  id: string;
  title: string;
  author: string;
  /** Short blurb from work description — empty when none. */
  teaser: string;
  tags: string[];
  /** `/api/assets/:id` or null when the work has no cover. */
  coverImageUrl: string | null;
  publishedAt: string;
  shelfStatus: DiscoverShelfStatus;
  progressRatio: number | null;
  sourceLabel: '官方';
};

export const DISCOVER_PAGE_SIZE = 9;

export const DISCOVER_ALL_TAG = '全部' as const;
export type DiscoverTagFilter = typeof DISCOVER_ALL_TAG | string;
