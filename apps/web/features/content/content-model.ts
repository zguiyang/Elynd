import type { ArticleLevel } from '@gloaming/shared/api/articles';

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
