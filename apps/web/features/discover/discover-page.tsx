'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  formatDiscoverApiError,
  themeFilterParam,
  useAddToShelfMutation,
  useDiscoverCatalogQuery,
} from '@/features/discover/discover-api';
import { DiscoverEmptyState } from '@/features/discover/discover-empty-state';
import { DiscoverFilters } from '@/features/discover/discover-filters';
import { DiscoverGrid } from '@/features/discover/discover-grid';
import { DiscoverHeader } from '@/features/discover/discover-header';
import { DISCOVER_ALL_THEME, DISCOVER_PAGE_SIZE, type DiscoverThemeFilter } from '@/features/discover/discover-model';
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
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get('empty') === '1';

  const [theme, setTheme] = useState<DiscoverThemeFilter>(DISCOVER_ALL_THEME);
  const [page, setPage] = useState(1);
  const [mobileVisible, setMobileVisible] = useState(DISCOVER_PAGE_SIZE);

  const listParams = useMemo(
    () => ({
      page,
      pageSize: DISCOVER_PAGE_SIZE,
      theme: themeFilterParam(theme),
    }),
    [page, theme],
  );

  const catalogQuery = useDiscoverCatalogQuery(listParams, { enabled: !isEmptyPreview });
  const addToShelf = useAddToShelfMutation();

  if (isEmptyPreview) {
    return (
      <div
        className={cn(
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
          'mx-auto flex w-full max-w-5xl min-h-[70dvh] flex-col justify-center',
        )}
      >
        <DiscoverHeader />
        <DiscoverEmptyState />
      </div>
    );
  }

  if (catalogQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <DiscoverHeader />
        <DiscoverSkeleton />
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center py-16 text-center">
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
  const themes = catalog.themes;
  const totalPages = catalog.pagination.totalPages;
  const safePage = Math.min(page, Math.max(1, totalPages));
  const desktopPageItems = items;
  const mobileItems = items.slice(0, mobileVisible);
  const hasMoreMobile = mobileVisible < items.length;
  const isCatalogEmpty = items.length === 0 && theme === DISCOVER_ALL_THEME;

  function resetFilters() {
    setTheme(DISCOVER_ALL_THEME);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleThemeChange(value: DiscoverThemeFilter) {
    setTheme(value);
    setPage(1);
    setMobileVisible(DISCOVER_PAGE_SIZE);
  }

  function handleAddToShelf(id: string) {
    addToShelf.mutate(id, {
      onSuccess: () => toast.success('已加入书架'),
      onError: (error) => toast.error(formatDiscoverApiError(error)),
    });
  }

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col',
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
          <DiscoverFilters theme={theme} themes={themes} onThemeChange={handleThemeChange} />

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
