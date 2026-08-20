'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon, Play } from 'lucide-react';
import Link from 'next/link';

import type { LearnArticleSummary, LearnTodayEntry } from '@gloaming/shared/api/learn';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { useAppUser } from '@/features/dashboard/app-shell';
import { greetingForHour } from '@/features/dashboard/dashboard-data';
import { formatLearnApiError, getLearnToday, learnQueryKey } from '@/features/learn/learn-api';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/library/library-model';
import { cn } from '@/lib/utils';

function articleMetaLine(article: LearnArticleSummary): string {
  const parts = [LEVEL_LABEL[article.level]];
  if (article.estimatedMinutes != null) {
    parts.push(`约 ${article.estimatedMinutes} 分钟`);
  }
  if (article.themes[0]) {
    parts.push(article.themes[0]);
  }
  return parts.join(' · ');
}

function ProgressHint({ ratio }: { ratio: number }) {
  if (ratio <= 0) {
    return null;
  }
  return <p className="mt-3 text-sm text-muted-foreground">大约读到 {ratio}%</p>;
}

function CurrentHero({ entry, activePracticeHref }: { entry: LearnTodayEntry; activePracticeHref: string | null }) {
  return (
    <section className="mt-10 flex flex-col items-stretch justify-between gap-8 rounded-3xl bg-paper p-8 md:flex-row md:items-center md:p-10">
      <div className="max-w-xl">
        <p className="mb-4 text-sm text-brand-deep">接着读</p>
        <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{entry.article.title}</h2>
        <p className="mt-5 text-sm text-muted-foreground">{articleMetaLine(entry.article)}</p>
        <ProgressHint ratio={entry.progress.progressRatio} />
        <div className="mt-7 flex flex-wrap gap-3">
          <Button
            nativeButton={false}
            className="h-11 gap-2 rounded-xl px-7 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.learnArticle(entry.article.id)} />}
          >
            <Play className="size-4" strokeWidth={1.5} aria-hidden />
            继续阅读
          </Button>
          {activePracticeHref ? (
            <Button
              nativeButton={false}
              variant="outline"
              className="h-11 rounded-xl border-border bg-card px-5 shadow-none"
              render={<Link href={activePracticeHref} />}
            >
              继续练习
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          'flex h-72 w-56 shrink-0 items-end rounded-3xl p-5 shadow-card ring-1 ring-foreground/5 md:h-80 md:w-64',
          coverTintForVolume(entry.article.themes, entry.article.title),
        )}
        aria-hidden
      >
        <p className="font-heading text-lg font-bold leading-snug text-foreground/80">{entry.article.title}</p>
      </div>
    </section>
  );
}

function EmptyHero() {
  return (
    <section className="mt-10 rounded-3xl bg-paper p-8 md:p-10">
      <p className="mb-4 text-sm text-brand-deep">今日还没有在读的文章</p>
      <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">从图书馆开始</h2>
      <Button
        nativeButton={false}
        className="mt-7 h-11 gap-2 rounded-xl px-7 hover:bg-brand-deep"
        render={<Link href={AUTH_ROUTES.library} />}
      >
        <BookOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
        打开图书馆
      </Button>
    </section>
  );
}

function ContinueReadingList({ entries }: { entries: LearnTodayEntry[] }) {
  return (
    <section className="mt-12">
      <h3 className="mb-5 text-xl font-semibold">继续阅读</h3>
      <div className="space-y-4">
        {entries.map((entry) => (
          <Link
            key={entry.article.id}
            href={AUTH_ROUTES.learnArticle(entry.article.id)}
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 transition-colors duration-300 ease-out-soft hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-row"
          >
            <div
              className={cn(
                'flex h-40 w-32 shrink-0 items-end rounded-2xl p-4',
                coverTintForVolume(entry.article.themes, entry.article.title),
              )}
              aria-hidden
            >
              <p className="line-clamp-3 text-sm font-semibold text-foreground/80">{entry.article.title}</p>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-heading text-2xl font-bold tracking-tight">{entry.article.title}</h4>
              <p className="mt-3 text-muted-foreground">{articleMetaLine(entry.article)}</p>
              <ProgressHint ratio={entry.progress.progressRatio} />
              <p className="mt-4 text-sm font-medium text-brand-deep">继续阅读</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RecommendationsList({ articles }: { articles: LearnArticleSummary[] }) {
  return (
    <section className="mt-12">
      <h3 className="mb-5 text-xl font-semibold">从图书馆挑一篇</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={AUTH_ROUTES.learnArticle(article.id)}
            className="flex gap-4 rounded-3xl border border-border bg-card p-4 transition-colors duration-300 ease-out-soft hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div
              className={cn(
                'flex h-24 w-20 shrink-0 items-end rounded-xl p-2',
                coverTintForVolume(article.themes, article.title),
              )}
              aria-hidden
            >
              <p className="line-clamp-3 text-[11px] font-semibold leading-snug text-foreground/80">{article.title}</p>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{article.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">{articleMetaLine(article)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function DashboardHome() {
  const user = useAppUser();
  const name = user?.name?.trim() || user?.username || '读者';
  const greeting = greetingForHour(new Date().getHours(), name);

  const todayQuery = useQuery({
    queryKey: learnQueryKey.today(),
    queryFn: ({ signal }) => getLearnToday({ signal }),
  });

  const current = todayQuery.data?.current ?? null;
  const continueReading = todayQuery.data?.continueReading ?? [];
  const activePractice = todayQuery.data?.activePractice ?? null;
  const recommendations = todayQuery.data?.recommendations ?? [];

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">{greeting}</h1>

      {todayQuery.isPending ? (
        <p className="mt-10 text-sm text-muted-foreground">加载中…</p>
      ) : todayQuery.isError ? (
        <Empty className="mt-10 border border-dashed border-border bg-card/50 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>暂时无法加载</EmptyTitle>
            <EmptyDescription>{formatLearnApiError(todayQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {current ? (
            <CurrentHero
              entry={current}
              activePracticeHref={activePractice ? AUTH_ROUTES.learnPractice(activePractice.articleId) : null}
            />
          ) : (
            <EmptyHero />
          )}
          {continueReading.length > 0 ? <ContinueReadingList entries={continueReading} /> : null}
          {recommendations.length > 0 ? <RecommendationsList articles={recommendations} /> : null}
        </>
      )}
    </div>
  );
}
