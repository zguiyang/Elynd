'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, LibraryIcon, SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { DEFAULT_LIBRARY_ARTICLE_SORT_BY, type LibraryArticleSortField } from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_ORDER, type SortOrder } from '@elynd/shared/api/pagination';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AUTH_ROUTES } from '@/constants';
import {
  formatLibraryApiError,
  type LibraryArticle,
  libraryArticlesQueryKey,
  type LibraryListParams,
  listPublishedArticles,
} from '@/features/library/articles-api';
import {
  coverTintForVolume,
  isDefaultLibrarySort,
  LEVEL_LABEL,
  LIBRARY_SORT_PRESETS,
  LIBRARY_THEME_ALL,
  parseLibrarySortBy,
  parseLibrarySortOrder,
  resolveLibrarySortPreset,
} from '@/features/library/library-model';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;
/** Soft-refresh cues stay visible at least this long (local APIs finish too fast otherwise). */
const SHELF_REFRESH_MIN_MS = 300;
/** First-paint shelf placeholders — matches common viewport density, not pageSize. */
const SHELF_SKELETON_COUNT = 8;

const shelfGridClassName = 'grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 xl:grid-cols-4';

function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_PAGE;
  }
  return Math.floor(n);
}

function parsePageSize(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.floor(n);
}

function VolumeCard({ article }: { article: LibraryArticle }) {
  const tint = coverTintForVolume(article.themes, article.title);
  const levelLabel = LEVEL_LABEL[article.level] ?? article.level;
  const minutes = article.estimatedMinutes != null ? `约 ${article.estimatedMinutes} 分钟` : null;
  const themeLine = article.themes.slice(0, 2).join(' · ');

  return (
    <Link
      href={AUTH_ROUTES.libraryArticle(article.id)}
      className={cn(
        'group flex flex-col rounded-3xl outline-none',
        'transition-transform duration-300 ease-out-soft',
        'hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      <div
        className={cn(
          'relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-3xl border border-border p-5 shadow-card ring-1 ring-foreground/5',
          'transition-colors duration-300 ease-out-soft group-hover:border-border/80',
          tint,
        )}
      >
        <p className="text-xs tracking-wide text-brand-deep">{levelLabel}</p>
        <h3
          className="font-heading line-clamp-5 text-xl font-bold tracking-tight text-foreground md:text-2xl"
          title={article.title}
        >
          {article.title}
        </h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          {themeLine ? <p className="line-clamp-1">{themeLine}</p> : null}
          {minutes ? <p>{minutes}</p> : null}
        </div>
      </div>

      <span
        className={cn(
          'mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground',
          'transition-colors duration-300 ease-out-soft group-hover:bg-brand-deep',
        )}
      >
        <BookOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
        开始阅读
      </span>
    </Link>
  );
}

const shelfTurnClassName = cn(
  'h-10 gap-2 rounded-xl border-border bg-card px-4 text-sm font-medium text-muted-foreground shadow-none',
  'transition-colors duration-300 ease-out-soft',
  'hover:border-border/80 hover:bg-muted/60 hover:text-foreground',
);

/** Paper-toned placeholders that preserve VolumeCard geometry (no layout jump). */
function VolumeCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <div
        className={cn(
          'aspect-[3/4] rounded-3xl border border-border/60 bg-paper ring-1 ring-foreground/5',
          'motion-safe:animate-pulse',
        )}
      />
      <div className={cn('mt-4 h-10 rounded-xl bg-muted/70', 'motion-safe:animate-pulse')} />
    </div>
  );
}

function ShelfSkeleton({ count }: { count: number }) {
  return (
    <div className={shelfGridClassName} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <VolumeCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Progress track under filters — always reserved so the shelf does not jump. */
function ShelfRefreshChrome({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={cn(
        'mt-4 h-0.5 w-full overflow-hidden rounded-full bg-border/50',
        'transition-opacity duration-300 ease-out-soft',
        isActive ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={!isActive}
    >
      <div className={cn('h-full w-1/3 rounded-full bg-primary', isActive && 'motion-safe:animate-shelf-progress')} />
    </div>
  );
}

/**
 * Keep a transient "active" UI flag on for at least `minMs` from when it became true.
 * setState only runs inside timeouts (avoids sync setState-in-effect lint).
 */
function useMinimumHold(isActive: boolean, minMs: number): boolean {
  const [isHolding, setIsHolding] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let isCancelled = false;
    let endHoldTimer: number | undefined;

    if (isActive) {
      if (startedAtRef.current == null) {
        startedAtRef.current = Date.now();
      }
      return () => {
        isCancelled = true;
        if (endHoldTimer != null) {
          window.clearTimeout(endHoldTimer);
        }
      };
    }

    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    if (startedAt == null) {
      return;
    }

    const remainMs = Math.max(0, minMs - (Date.now() - startedAt));
    const startHoldTimer = window.setTimeout(() => {
      if (isCancelled) {
        return;
      }
      setIsHolding(true);
      endHoldTimer = window.setTimeout(() => {
        if (!isCancelled) {
          setIsHolding(false);
        }
      }, remainMs);
    }, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(startHoldTimer);
      if (endHoldTimer != null) {
        window.clearTimeout(endHoldTimer);
      }
    };
  }, [isActive, minMs]);

  return isActive || isHolding;
}

export function LibraryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = parsePage(searchParams.get('page'));
  const pageSize = parsePageSize(searchParams.get('pageSize'));
  const themeParam = searchParams.get('theme')?.trim() || LIBRARY_THEME_ALL;
  const qParam = searchParams.get('q')?.trim() ?? '';
  const sortBy = parseLibrarySortBy(searchParams.get('sortBy'));
  const sortOrder = parseLibrarySortOrder(searchParams.get('sortOrder'));
  const sortPreset = resolveLibrarySortPreset(sortBy, sortOrder);

  const [searchInput, setSearchInput] = useState(qParam);

  const listParams: LibraryListParams = {
    page,
    pageSize,
    sortBy,
    sortOrder,
    theme: themeParam === LIBRARY_THEME_ALL ? undefined : themeParam,
    q: qParam || undefined,
  };

  const listQuery = useQuery({
    queryKey: libraryArticlesQueryKey.list(listParams),
    queryFn: ({ signal }) => listPublishedArticles(listParams, { signal }),
    placeholderData: keepPreviousData,
  });

  const isInitialLoading = listQuery.isPending && !listQuery.data;
  const isSoftRefreshing = listQuery.isFetching && Boolean(listQuery.isPlaceholderData);
  const isShelfRefreshVisible = useMinimumHold(isSoftRefreshing, SHELF_REFRESH_MIN_MS);

  const articles = listQuery.data?.items ?? [];
  const themes = listQuery.data?.themes ?? [];
  const pagination = listQuery.data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : page;
  const hasPrevPage = safePage > 1;
  const hasNextPage = totalPages > 0 && safePage < totalPages;
  const shelfValue = themeParam === LIBRARY_THEME_ALL || themes.includes(themeParam) ? themeParam : LIBRARY_THEME_ALL;

  const hasSearch = Boolean(qParam) || Boolean(searchInput.trim());
  const hasActiveFilters =
    themeParam !== LIBRARY_THEME_ALL || Boolean(qParam) || !isDefaultLibrarySort(sortBy, sortOrder);

  function replaceQuery(next: {
    theme?: string;
    q?: string;
    page?: number;
    sortBy?: LibraryArticleSortField;
    sortOrder?: SortOrder;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextTheme = next.theme ?? themeParam;
    const nextQ = next.q !== undefined ? next.q : qParam;
    const nextPage = next.page ?? safePage;
    const nextSortBy = next.sortBy ?? sortBy;
    const nextSortOrder = next.sortOrder ?? sortOrder;

    if (nextTheme === LIBRARY_THEME_ALL) {
      params.delete('theme');
    } else {
      params.set('theme', nextTheme);
    }

    if (!nextQ.trim()) {
      params.delete('q');
    } else {
      params.set('q', nextQ.trim());
    }

    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }

    if (pageSize === DEFAULT_PAGE_SIZE) {
      params.delete('pageSize');
    } else {
      params.set('pageSize', String(pageSize));
    }

    if (nextSortBy === DEFAULT_LIBRARY_ARTICLE_SORT_BY) {
      params.delete('sortBy');
    } else {
      params.set('sortBy', nextSortBy);
    }

    if (nextSortOrder === DEFAULT_SORT_ORDER) {
      params.delete('sortOrder');
    } else {
      params.set('sortOrder', nextSortOrder);
    }

    const qs = params.toString();
    router.replace(qs ? `${AUTH_ROUTES.library}?${qs}` : AUTH_ROUTES.library);
  }

  function clearSearch() {
    setSearchInput('');
    replaceQuery({ q: '', page: DEFAULT_PAGE });
  }

  function resetFilters() {
    setSearchInput('');
    router.replace(AUTH_ROUTES.library);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextQ = searchInput.trim();
      if (nextQ === qParam) {
        return;
      }
      replaceQuery({ q: nextQ, page: DEFAULT_PAGE });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce typing only; replaceQuery closes over latest URL state
  }, [searchInput]);

  useEffect(() => {
    if (!pagination) {
      return;
    }
    if (pagination.totalPages >= 1 && page > pagination.totalPages) {
      replaceQuery({ page: pagination.totalPages });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp once when meta/page diverge
  }, [pagination?.totalPages, page]);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-sm tracking-wide text-brand-deep">图书馆</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">探索英语内容</h1>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">
            选择你感兴趣的真实短文，像抽一册书那样开始读一会儿。
          </p>
        </div>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <LibraryIcon className="size-5" strokeWidth={1.5} aria-hidden />
        </div>
      </header>

      <div className="relative mt-8">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="搜索标题或主题…"
          aria-label="搜索标题或主题"
          className={cn(
            'h-12 rounded-2xl border-border bg-card pl-11 text-base shadow-none md:text-sm',
            hasSearch ? 'pr-12' : 'pr-4',
          )}
        />
        {hasSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="清除搜索"
            className="absolute top-1/2 right-2 size-8 -translate-y-1/2 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={clearSearch}
          >
            <XIcon className="size-4" strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {themes.length > 0 ? (
          <Tabs
            value={shelfValue}
            onValueChange={(value) => {
              if (typeof value === 'string' && value) {
                replaceQuery({ theme: value, page: DEFAULT_PAGE });
              }
            }}
            className="min-w-0"
          >
            <TabsList
              variant="default"
              className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/80 p-1.5 group-data-horizontal/tabs:h-auto sm:w-fit"
            >
              <TabsTrigger
                value={LIBRARY_THEME_ALL}
                className={cn(
                  'h-auto min-h-0 flex-none rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground',
                  'border border-transparent shadow-none after:hidden',
                  'data-active:border-border/80 data-active:bg-card data-active:font-semibold data-active:text-foreground data-active:shadow-sm',
                )}
              >
                全部
              </TabsTrigger>
              {themes.map((item) => (
                <TabsTrigger
                  key={item}
                  value={item}
                  className={cn(
                    'h-auto min-h-0 flex-none rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground',
                    'border border-transparent shadow-none after:hidden',
                    'data-active:border-border/80 data-active:bg-card data-active:font-semibold data-active:text-foreground data-active:shadow-sm',
                  )}
                >
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <div className="min-w-0" />
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">排序</span>
            <Select
              items={LIBRARY_SORT_PRESETS.map((item) => ({ value: item.value, label: item.label }))}
              value={sortPreset.value}
              onValueChange={(value) => {
                if (value == null) {
                  return;
                }
                const preset = LIBRARY_SORT_PRESETS.find((item) => item.value === value);
                if (!preset) {
                  return;
                }
                replaceQuery({
                  sortBy: preset.sortBy,
                  sortOrder: preset.sortOrder,
                  page: DEFAULT_PAGE,
                });
              }}
            >
              <SelectTrigger aria-label="排序方式" className="h-10 w-[9.5rem] rounded-xl bg-card shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {LIBRARY_SORT_PRESETS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground"
              onClick={resetFilters}
            >
              清除筛选
            </Button>
          ) : null}
        </div>
      </div>

      <ShelfRefreshChrome isActive={isShelfRefreshVisible || isInitialLoading} />

      <section className="mt-8" aria-busy={isInitialLoading || isShelfRefreshVisible}>
        {isShelfRefreshVisible ? <span className="sr-only">正在更新书架</span> : null}
        {isInitialLoading ? (
          <ShelfSkeleton count={SHELF_SKELETON_COUNT} />
        ) : listQuery.isError && !listQuery.data ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>书架暂时打不开</EmptyTitle>
              <EmptyDescription>{formatLibraryApiError(listQuery.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : articles.length === 0 ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>
                {total === 0 && !listParams.theme && !listParams.q ? '架上还没有册子' : '没有符合条件的册子'}
              </EmptyTitle>
              <EmptyDescription>
                {total === 0 && !listParams.theme && !listParams.q
                  ? '发布后的短文会出现在这里。先休息一下，稍后再来看看。'
                  : '试试换个主题，或清除筛选后再浏览。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="relative">
            <div
              className={cn(
                shelfGridClassName,
                'transition-opacity duration-500 ease-out-soft',
                isShelfRefreshVisible && 'pointer-events-none opacity-40',
              )}
            >
              {articles.map((article) => (
                <VolumeCard key={article.id} article={article} />
              ))}
            </div>
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 top-10 flex justify-center',
                'transition-opacity duration-300 ease-out-soft',
                isShelfRefreshVisible ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden={!isShelfRefreshVisible}
            >
              <div className="rounded-2xl border border-border bg-card/95 px-4 py-2.5 text-sm shadow-card">
                <span className="text-brand-deep">正在整理书架…</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {!isInitialLoading && !listQuery.isError && (hasPrevPage || hasNextPage) ? (
        <nav aria-label="书架翻页" className="mt-10 flex items-center justify-center gap-3">
          {hasPrevPage ? (
            <Button
              type="button"
              variant="outline"
              className={shelfTurnClassName}
              onClick={() => replaceQuery({ page: safePage - 1 })}
            >
              <ChevronLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
              上一页
            </Button>
          ) : null}
          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className={shelfTurnClassName}
              onClick={() => replaceQuery({ page: safePage + 1 })}
            >
              下一页
              <ChevronRightIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
