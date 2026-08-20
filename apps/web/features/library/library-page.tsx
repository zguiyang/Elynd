'use client';

import { BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, LibraryIcon, SearchIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DEFAULT_LIBRARY_ARTICLE_SORT_BY, type LibraryArticleSortField } from '@gloaming/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_ORDER, type SortOrder } from '@gloaming/shared/api/pagination';

import { LoadingOverlay } from '@/components/loading-overlay';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AUTH_ROUTES } from '@/constants';
import {
  formatLibraryApiError,
  type LibraryArticle,
  libraryArticlesQueryKey,
  type LibraryListParams,
  type LibraryListResult,
  listPublishedArticles,
} from '@/features/library/articles-api';
import {
  coverTintForVolume,
  DEFAULT_LIBRARY_SORT_PRESET,
  isDefaultLibrarySort,
  LEVEL_LABEL,
  LIBRARY_SORT_PRESETS,
  LIBRARY_THEME_ALL,
  resolveLibrarySortPreset,
} from '@/features/library/library-model';
import { usePaginatedQuery } from '@/lib/query';
import { cn } from '@/lib/utils';

const SEARCH_DEBOUNCE_MS = 300;
const SHELF_REFRESH_MIN_MS = 300;
const SHELF_SKELETON_COUNT = 8;

const shelfGridClassName = 'grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 xl:grid-cols-4';

function VolumeCard({ article }: { article: LibraryArticle }) {
  const tint = coverTintForVolume(article.themes, article.title);
  const levelLabel = LEVEL_LABEL[article.level] ?? article.level;
  const minutes = article.estimatedMinutes != null ? `约 ${article.estimatedMinutes} 分钟` : null;
  const themeLine = article.themes.slice(0, 2).join(' · ');

  return (
    <Link
      href={AUTH_ROUTES.learnArticle(article.id)}
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

function VolumeCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      <Skeleton className="aspect-[3/4] rounded-3xl border border-border/60 bg-paper ring-1 ring-foreground/5" />
      <Skeleton className="mt-4 h-10 rounded-xl bg-muted/70" />
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

export function LibraryPage() {
  const [page, setPage] = useState<number>(DEFAULT_PAGE);
  const [theme, setTheme] = useState<string>(LIBRARY_THEME_ALL);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<LibraryArticleSortField>(DEFAULT_LIBRARY_ARTICLE_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [searchInput, setSearchInput] = useState('');

  const sortPreset = resolveLibrarySortPreset(sortBy, sortOrder);

  const listParams: LibraryListParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy,
    sortOrder,
    theme: theme === LIBRARY_THEME_ALL ? undefined : theme,
    q: q || undefined,
  };

  const list = usePaginatedQuery<LibraryArticle, LibraryListResult>({
    queryKey: libraryArticlesQueryKey.list(listParams),
    queryFn: ({ signal }) => listPublishedArticles(listParams, { signal }),
    page,
    onPageChange: setPage,
    softRefreshMinMs: SHELF_REFRESH_MIN_MS,
  });

  const themes = list.data?.themes ?? [];
  const shelfValue = theme === LIBRARY_THEME_ALL || themes.includes(theme) ? theme : LIBRARY_THEME_ALL;
  const hasSearch = Boolean(q) || Boolean(searchInput.trim());
  const hasActiveFilters = theme !== LIBRARY_THEME_ALL || Boolean(q) || !isDefaultLibrarySort(sortBy, sortOrder);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextQ = searchInput.trim();
      if (nextQ === q) {
        return;
      }
      setQ(nextQ);
      setPage(DEFAULT_PAGE);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, q]);

  function clearSearch() {
    setSearchInput('');
    setQ('');
    setPage(DEFAULT_PAGE);
  }

  function resetFilters() {
    setSearchInput('');
    setQ('');
    setTheme(LIBRARY_THEME_ALL);
    setSortBy(DEFAULT_LIBRARY_SORT_PRESET.sortBy);
    setSortOrder(DEFAULT_LIBRARY_SORT_PRESET.sortOrder);
    setPage(DEFAULT_PAGE);
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">图书馆</h1>
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
                setTheme(value);
                setPage(DEFAULT_PAGE);
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
                setSortBy(preset.sortBy);
                setSortOrder(preset.sortOrder);
                setPage(DEFAULT_PAGE);
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

      <section className="mt-8" aria-busy={list.isInitialLoading || list.isSoftRefreshing}>
        {list.isInitialLoading ? (
          <ShelfSkeleton count={SHELF_SKELETON_COUNT} />
        ) : list.isError && !list.data ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>暂时无法加载</EmptyTitle>
              <EmptyDescription>{formatLibraryApiError(list.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : list.items.length === 0 ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>
                {list.total === 0 && !listParams.theme && !listParams.q ? '暂无文章' : '没有符合条件的结果'}
              </EmptyTitle>
              <EmptyDescription>
                {list.total === 0 && !listParams.theme && !listParams.q
                  ? '发布后的文章会显示在这里。'
                  : '试试换个主题，或清除筛选后再浏览。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <LoadingOverlay active={list.isSoftRefreshing} label="加载中…">
            <div className={shelfGridClassName}>
              {list.items.map((article) => (
                <VolumeCard key={article.id} article={article} />
              ))}
            </div>
          </LoadingOverlay>
        )}
      </section>

      {!list.isInitialLoading && !list.isError && (list.hasPrevPage || list.hasNextPage) ? (
        <nav aria-label="书架翻页" className="mt-10 flex items-center justify-center gap-3">
          {list.hasPrevPage ? (
            <Button type="button" variant="outline" className={shelfTurnClassName} onClick={list.goPrev}>
              <ChevronLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
              上一页
            </Button>
          ) : null}
          {list.hasNextPage ? (
            <Button type="button" variant="outline" className={shelfTurnClassName} onClick={list.goNext}>
              下一页
              <ChevronRightIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
