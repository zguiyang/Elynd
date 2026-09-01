import { describe, expect, it } from 'vitest';

import type { ShelfItem } from '@gloaming/shared/api/shelf';
import type { Work } from '@gloaming/shared/api/works';

import { resolveShelfStatus, toDiscoverItem } from '@/features/discover/discover-api';

function sampleWork(overrides: Partial<Work> = {}): Work {
  return {
    id: 'work-1',
    title: 'Sample Title',
    author: '  Jane Austen  ',
    description:
      'A long enough description that should be trimmed for the discover card teaser when it exceeds the list limit used on the discover catalog cards.',
    language: 'en',
    status: 'published',
    visibility: 'catalog',
    originKind: 'admin_epub',
    tags: ['Classic'],
    sources: ['Project Gutenberg'],
    coverAssetId: 'asset-cover-1',
    publishedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toDiscoverItem', () => {
  it('maps cover URL, author, and teaser from catalog work', () => {
    const item = toDiscoverItem(sampleWork());
    expect(item.coverImageUrl).toBe('/api/assets/asset-cover-1');
    expect(item.author).toBe('Jane Austen');
    expect(item.teaser.length).toBeGreaterThan(0);
    expect(item.teaser.length).toBeLessThanOrEqual(120);
    expect(item.sourceLabel).toBe('官方');
    expect(item.shelfStatus).toBe('available');
  });

  it('omits cover URL and trims empty description', () => {
    const item = toDiscoverItem(sampleWork({ coverAssetId: null, description: '   ', author: '' }));
    expect(item.coverImageUrl).toBeNull();
    expect(item.teaser).toBe('');
    expect(item.author).toBe('');
  });
});

describe('resolveShelfStatus', () => {
  it('marks in-progress when shelf progress is positive', () => {
    const shelfItem = {
      state: { status: 'in_progress', progressRatio: 12 },
    } as ShelfItem;
    expect(resolveShelfStatus(shelfItem)).toBe('in_progress');
  });
});
