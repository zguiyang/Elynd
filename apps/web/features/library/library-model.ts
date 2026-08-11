import type { ArticleLevel } from '@elynd/shared/api/articles';

export const LIBRARY_THEME_ALL = 'all' as const;

export const LEVEL_LABEL: Record<ArticleLevel, string> = {
  easy: '简单',
  mid: '中等',
  stretch: '稍难',
};

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

export function aggregateThemes(items: { themes: string[] }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of items) {
    for (const theme of item.themes) {
      const key = theme.trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

export function filterLibraryArticles<T extends { title: string; themes: string[] }>(
  items: T[],
  options: { theme: string; query: string },
): T[] {
  const theme = options.theme.trim();
  const query = options.query.trim().toLowerCase();

  return items.filter((item) => {
    if (theme !== LIBRARY_THEME_ALL && !item.themes.some((t) => t.trim() === theme)) {
      return false;
    }
    if (!query) {
      return true;
    }
    const isInTitle = item.title.toLowerCase().includes(query);
    const isInThemes = item.themes.some((t) => t.toLowerCase().includes(query));
    return isInTitle || isInThemes;
  });
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
