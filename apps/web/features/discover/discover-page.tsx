'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/features/auth';
import {
  formatDiscoverApiError,
  tagFilterParam,
  useAddToShelfMutation,
  useDiscoverCatalogQuery,
} from '@/features/discover/discover-api';
import { DiscoverEmptyState } from '@/features/discover/discover-empty-state';
import { DiscoverFilters } from '@/features/discover/discover-filters';
import { DiscoverGrid } from '@/features/discover/discover-grid';
import { DiscoverHeader } from '@/features/discover/discover-header';
import { DISCOVER_ALL_TAG, DISCOVER_PAGE_SIZE, type DiscoverTagFilter } from '@/features/discover/discover-model';
import { DiscoverPagination } from '@/features/discover/discover-pagination';
import { cn } from '@/lib/utils';

function DiscoverSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: DISCOVER_PAGE_SIZE }, (_, i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-surface-container-high md:h-96" />
      ))}
    </div>
  );
}

export function DiscoverPage() {
  const [tag, setTag] = useState<DiscoverTagFilter>(DISCOVER_ALL_TAG);
  const [page, setPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(DISCOVER_PAGE_SIZE);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: DISCOVER_PAGE_SIZE,
      tag: tagFilterParam(tag),
    }),
    [page, tag],
  );

  const catalogQuery = useDiscoverCatalogQuery(listParams);
  const addToShelf = useAddToShelfMutation();
  const requireAuth = useRequireAuth();

  if (catalogQuery.isPending) {
    return (
      <div className="flex w-full flex-col">
        <DiscoverHeader />
        <DiscoverSkeleton />
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <div className="flex w-full flex-col items-center py-16 text-center">
        <DiscoverHeader />
        <h2 className="font-heading text-2xl font-semibold">无法加载目录</h2>
        <p className="mt-4 text-muted-foreground">{formatDiscoverApiError(catalogQuery.error)}</p>
        <Button className="mt-8 rounded-full px-10" onClick={() => void catalogQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const catalog = catalogQuery.data;
  const items = catalog.items;
  const tags = catalog.tags;
  const totalPages = catalog.pagination.totalPages;
  const safePage = Math.min(page, Math.max(1, totalPages));
  const desktopPageItems = items;
  const mobileItems = items.slice(0, mobileVisible);
  const hasMoreMobile = mobileVisible < items.length;
  const isCatalogEmpty = items.length === 0 && tag === DISCOVER_ALL_TAG;

  function resetFilters() {
    setTag(DISCOVER_ALL_TAG);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleTagChange(value: DiscoverTagFilter) {
    setTag(value);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleAddToShelf(id: string) {
    if (!requireAuth({ reason: 'bookmark' })) {
      return;
    }
    addToShelf.mutate(id, {
      onSuccess: () => toast.success('已加入书架'),
      onError: (error) => toast.error(formatDiscoverApiError(error)),
    });
  }

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'flex w-full flex-col',
        isCatalogEmpty ? 'min-h-[70dvh] justify-center' : '',
      )}
    >
      {isCatalogEmpty ? (
        <>
          <DiscoverHeader />
          <DiscoverEmptyState />
        </>
      ) : (
        <>
          <DiscoverHeader />
          <DiscoverFilters tag={tag} tags={tags} onTagChange={handleTagChange} />

          {items.length === 0 ? (
            <DiscoverEmptyState onResetFilters={resetFilters} />
          ) : (
            <>
              <div className="md:hidden">
                <DiscoverGrid items={mobileItems} onAddToShelf={handleAddToShelf} addingId={addToShelf.variables} />
              </div>
              <div className="hidden md:block">
                <DiscoverGrid
                  items={desktopPageItems}
                  onAddToShelf={handleAddToShelf}
                  addingId={addToShelf.variables}
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
