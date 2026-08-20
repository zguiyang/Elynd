import {
  type ArticleLevel,
  DEFAULT_LIBRARY_ARTICLE_SORT_BY,
  type LibraryArticleSortField,
} from '@gloaming/shared/api/articles';
import { DEFAULT_SORT_ORDER, type SortOrder } from '@gloaming/shared/api/pagination';

export const LIBRARY_THEME_ALL = 'all' as const;

export const LEVEL_LABEL: Record<ArticleLevel, string> = {
  easy: '简单',
  mid: '中等',
  stretch: '稍难',
};

/** Combined sort presets for the library shelf (maps to API sortBy + sortOrder). */
export const LIBRARY_SORT_PRESETS = [
  { value: 'publishedAt:desc', label: '最新发布', sortBy: 'publishedAt', sortOrder: 'desc' },
  { value: 'publishedAt:asc', label: '最早发布', sortBy: 'publishedAt', sortOrder: 'asc' },
  { value: 'updatedAt:desc', label: '最近更新', sortBy: 'updatedAt', sortOrder: 'desc' },
  { value: 'createdAt:desc', label: '最近创建', sortBy: 'createdAt', sortOrder: 'desc' },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  sortBy: LibraryArticleSortField;
  sortOrder: SortOrder;
}>;

export type LibrarySortPreset = (typeof LIBRARY_SORT_PRESETS)[number];

export const DEFAULT_LIBRARY_SORT_PRESET = LIBRARY_SORT_PRESETS[0];

export function resolveLibrarySortPreset(sortBy: LibraryArticleSortField, sortOrder: SortOrder): LibrarySortPreset {
  return (
    LIBRARY_SORT_PRESETS.find((item) => item.sortBy === sortBy && item.sortOrder === sortOrder) ??
    DEFAULT_LIBRARY_SORT_PRESET
  );
}

export function parseLibrarySortBy(raw: string | null): LibraryArticleSortField {
  if (raw === 'publishedAt' || raw === 'updatedAt' || raw === 'createdAt') {
    return raw;
  }
  return DEFAULT_LIBRARY_ARTICLE_SORT_BY;
}

export function parseLibrarySortOrder(raw: string | null): SortOrder {
  if (raw === 'asc' || raw === 'desc') {
    return raw;
  }
  return DEFAULT_SORT_ORDER;
}

export function isDefaultLibrarySort(sortBy: LibraryArticleSortField, sortOrder: SortOrder): boolean {
  return sortBy === DEFAULT_LIBRARY_ARTICLE_SORT_BY && sortOrder === DEFAULT_SORT_ORDER;
}

/** Semantic cover washes — deterministic pick from theme/title seed. */
export const VOLUME_COVER_TINTS = ['bg-paper', 'bg-muted', 'bg-secondary', 'bg-accent/50'] as const;

export type VolumeCoverTint = (typeof VOLUME_COVER_TINTS)[number];

export function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function coverTintForVolume(themes: string[], title: string): VolumeCoverTint {
  const seed = themes[0]?.trim() || title.trim() || 'volume';
  return VOLUME_COVER_TINTS[hashSeed(seed) % VOLUME_COVER_TINTS.length]!;
}

export function paragraphsFromBody(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}
