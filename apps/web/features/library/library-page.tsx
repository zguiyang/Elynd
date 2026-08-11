'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon, LibraryIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AUTH_ROUTES } from '@/constants';
import {
  formatLibraryApiError,
  type LibraryArticle,
  libraryArticlesQueryKey,
  listPublishedArticles,
} from '@/features/library/articles-api';
import {
  aggregateThemes,
  coverTintForVolume,
  filterLibraryArticles,
  LEVEL_LABEL,
  LIBRARY_THEME_ALL,
} from '@/features/library/library-model';
import { cn } from '@/lib/utils';

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

export function LibraryPage() {
  const [theme, setTheme] = useState<string>(LIBRARY_THEME_ALL);
  const [query, setQuery] = useState('');

  const listQuery = useQuery({
    queryKey: libraryArticlesQueryKey.list(),
    queryFn: ({ signal }) => listPublishedArticles({ signal }),
  });

  const articles = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const themes = useMemo(() => aggregateThemes(articles), [articles]);
  const filtered = useMemo(() => filterLibraryArticles(articles, { theme, query }), [articles, theme, query]);

  const shelfValue = theme === LIBRARY_THEME_ALL || themes.includes(theme) ? theme : LIBRARY_THEME_ALL;

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
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题或主题…"
          aria-label="搜索标题或主题"
          className="h-12 rounded-2xl border-border bg-card pr-4 pl-11 text-base shadow-none md:text-sm"
        />
      </div>

      {themes.length > 0 ? (
        <Tabs
          value={shelfValue}
          onValueChange={(value) => {
            if (typeof value === 'string' && value) {
              setTheme(value);
            }
          }}
          className="mt-8"
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
      ) : null}

      <section className="mt-10">
        {listQuery.isPending ? (
          <p className="text-sm text-muted-foreground">正在整理书架…</p>
        ) : listQuery.isError ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>书架暂时打不开</EmptyTitle>
              <EmptyDescription>{formatLibraryApiError(listQuery.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty className="border border-dashed border-border bg-card/50 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryIcon />
              </EmptyMedia>
              <EmptyTitle>{articles.length === 0 ? '架上还没有册子' : '没有符合条件的册子'}</EmptyTitle>
              <EmptyDescription>
                {articles.length === 0
                  ? '发布后的短文会出现在这里。先休息一下，稍后再来看看。'
                  : '试试换个主题，或清空搜索后再浏览。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {filtered.map((article) => (
              <VolumeCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
