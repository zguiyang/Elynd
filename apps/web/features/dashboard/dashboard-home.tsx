'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenIcon, Play } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { useAppUser } from '@/features/dashboard/app-shell';
import { DASHBOARD_FAKE, greetingForHour } from '@/features/dashboard/dashboard-data';
import { formatLearnApiError, getLearnToday, learnQueryKey } from '@/features/learn/learn-api';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/library/library-model';
import { cn } from '@/lib/utils';

export function DashboardHome() {
  const user = useAppUser();
  const name = user?.name?.trim() || user?.username || '读者';
  const greeting = greetingForHour(new Date().getHours(), name);
  const { recommendations, stats } = DASHBOARD_FAKE;

  const todayQuery = useQuery({
    queryKey: learnQueryKey.today(),
    queryFn: ({ signal }) => getLearnToday({ signal }),
  });

  const current = todayQuery.data?.current ?? null;
  const continueReading = todayQuery.data?.continueReading ?? [];
  const activePractice = todayQuery.data?.activePractice ?? null;

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
      ) : current ? (
        <section className="mt-10 flex flex-col items-stretch justify-between gap-8 rounded-3xl bg-paper p-8 md:flex-row md:items-center md:p-10">
          <div className="max-w-xl">
            <p className="mb-4 text-sm text-brand-deep">接着读</p>
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{current.article.title}</h2>

            <div className="mt-5 flex flex-wrap gap-5 text-sm text-muted-foreground">
              <span>{LEVEL_LABEL[current.article.level]}</span>
              {current.article.estimatedMinutes != null ? (
                <span>约 {current.article.estimatedMinutes} 分钟</span>
              ) : null}
              {current.article.themes[0] ? <span>{current.article.themes[0]}</span> : null}
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-soft"
                style={{ width: `${current.progress.progressRatio}%` }}
              />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                nativeButton={false}
                className="h-11 gap-2 rounded-xl px-7 hover:bg-brand-deep"
                render={<Link href={AUTH_ROUTES.learnArticle(current.article.id)} />}
              >
                <Play className="size-4" strokeWidth={1.5} aria-hidden />
                继续阅读
              </Button>
              {activePractice ? (
                <Button
                  nativeButton={false}
                  variant="outline"
                  className="h-11 rounded-xl border-border bg-card px-5 shadow-none"
                  render={<Link href={AUTH_ROUTES.learnPractice(activePractice.articleId)} />}
                >
                  继续练习
                </Button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'flex h-72 w-56 shrink-0 items-end rounded-3xl p-5 shadow-card ring-1 ring-foreground/5 md:h-80 md:w-64',
              coverTintForVolume(current.article.themes, current.article.title),
            )}
            aria-hidden
          >
            <p className="font-heading text-lg font-bold leading-snug text-foreground/80">{current.article.title}</p>
          </div>
        </section>
      ) : (
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
      )}

      <section className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-5 text-xl font-semibold">继续阅读</h3>
          {continueReading.length > 0 ? (
            <div className="space-y-4">
              {continueReading.map((entry) => (
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
                    <p className="mt-3 text-muted-foreground">
                      {LEVEL_LABEL[entry.article.level]}
                      {entry.article.estimatedMinutes != null ? ` · 约 ${entry.article.estimatedMinutes} 分钟` : ''}
                    </p>
                    <div className="mt-5 text-sm text-foreground">阅读进度 {entry.progress.progressRatio}%</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${entry.progress.progressRatio}%` }}
                      />
                    </div>
                    <p className="mt-4 text-sm font-medium text-brand-deep">继续阅读</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-10 text-sm text-muted-foreground">
              暂无其他在读
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-5 text-xl font-semibold">为你推荐</h3>
          <p className="mb-4 text-xs text-muted-foreground">示例</p>
          <div className="space-y-4">
            {recommendations.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-3xl border border-border bg-card p-4 transition-colors duration-300 ease-out-soft hover:bg-muted/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static prototype cover */}
                <img className="h-24 w-20 shrink-0 rounded-xl object-cover" src={item.coverSrc} alt={item.coverAlt} />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8">
        <h3 className="text-xl font-semibold">阅读统计</h3>
        <p className="mt-2 text-xs text-muted-foreground">示例</p>
        <div className="mt-8 grid grid-cols-3 gap-4 text-foreground">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
