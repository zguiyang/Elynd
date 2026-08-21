'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { DiscoverEmptyState } from '@/features/discover/discover-empty-state';
import { DiscoverFilters } from '@/features/discover/discover-filters';
import { DiscoverGrid } from '@/features/discover/discover-grid';
import { DiscoverHeader } from '@/features/discover/discover-header';
import {
  DISCOVER_MOCK_EMPTY,
  DISCOVER_MOCK_POPULATED,
  DISCOVER_PAGE_SIZE,
  type DiscoverCategory,
  type DiscoverShelfStatus,
  type DiscoverSortValue,
  type DiscoverTag,
  filterDiscoverItems,
  sortDiscoverItems,
} from '@/features/discover/discover-mock';
import { DiscoverPagination } from '@/features/discover/discover-pagination';
import { cn } from '@/lib/utils';

/**
 * Discover UI prototype: local mock catalog only (no library/shelf API).
 * Append `?empty=1` to preview the empty catalog state.
 */
export function DiscoverPage() {
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get('empty') === '1';
  const catalog = isEmptyPreview ? DISCOVER_MOCK_EMPTY : DISCOVER_MOCK_POPULATED;

  const [category, setCategory] = useState<DiscoverCategory>('全部');
  const [tag, setTag] = useState<DiscoverTag>('全部');
  const [sort, setSort] = useState<DiscoverSortValue>('newest');
  const [page, setPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(DISCOVER_PAGE_SIZE);
  const [shelfOverrides, setShelfOverrides] = useState<Record<string, DiscoverShelfStatus>>({});

  const filtered = useMemo(() => {
    const next = filterDiscoverItems(catalog.items, category, tag);
    return sortDiscoverItems(next, sort);
  }, [catalog.items, category, tag, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / DISCOVER_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * DISCOVER_PAGE_SIZE;
  const desktopPageItems = filtered.slice(pageStart, pageStart + DISCOVER_PAGE_SIZE);
  const mobileItems = filtered.slice(0, mobileVisible);
  const hasMoreMobile = mobileVisible < filtered.length;
  const isFilterEmpty = !isEmptyPreview && catalog.items.length > 0 && filtered.length === 0;
  const isCatalogEmpty = isEmptyPreview || catalog.items.length === 0;

  function resetFilters() {
    setCategory('全部');
    setTag('全部');
    setSort('newest');
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleCategoryChange(value: DiscoverCategory) {
    setCategory(value);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleTagChange(value: DiscoverTag) {
    setTag(value);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleSortChange(value: DiscoverSortValue) {
    setSort(value);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleAddToShelf(id: string) {
    setShelfOverrides((prev) => ({ ...prev, [id]: 'on_shelf' }));
  }

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col',
        isCatalogEmpty ? 'min-h-[70dvh] justify-center' : '',
      )}
    >
      {!isEmptyPreview ? (
        <p className="mb-4 text-center text-xs text-muted-foreground md:mb-6">
          界面预览（假数据）· 加 ?empty=1 看空目录
        </p>
      ) : null}

      {isCatalogEmpty ? (
        <>
          <DiscoverHeader />
          <DiscoverEmptyState />
        </>
      ) : (
        <>
          <DiscoverHeader />
          <DiscoverFilters
            category={category}
            tag={tag}
            sort={sort}
            onCategoryChange={handleCategoryChange}
            onTagChange={handleTagChange}
            onSortChange={handleSortChange}
          />

          {isFilterEmpty ? (
            <DiscoverEmptyState onResetFilters={resetFilters} />
          ) : (
            <>
              {/* Mobile single-column feed */}
              <div className="md:hidden">
                <DiscoverGrid items={mobileItems} shelfOverrides={shelfOverrides} onAddToShelf={handleAddToShelf} />
              </div>
              {/* Desktop bookstore grid (paginated) */}
              <div className="hidden md:block">
                <DiscoverGrid
                  items={desktopPageItems}
                  shelfOverrides={shelfOverrides}
                  onAddToShelf={handleAddToShelf}
                />
              </div>
              <DiscoverPagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                hasMoreMobile={hasMoreMobile}
                onLoadMore={() => setMobileVisible((n) => n + DISCOVER_PAGE_SIZE)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
