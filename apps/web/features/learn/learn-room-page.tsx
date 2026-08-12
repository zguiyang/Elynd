'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, BookOpenIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { formatLearnApiError, getLearnArticle, learnQueryKey, updateLearnProgress } from '@/features/learn/learn-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { ApiRequestError } from '@/lib/api-request';

type LearnRoomPageProps = {
  articleId: string;
};

/**
 * Learning Room — published article + reading progress.
 * Assist / TTS intentionally omitted for this pass.
 */
export function LearnRoomPage({ articleId }: LearnRoomPageProps) {
  const queryClient = useQueryClient();
  const lastReportedRatio = useRef(0);

  const articleQuery = useQuery({
    queryKey: learnQueryKey.article(articleId),
    queryFn: ({ signal }) => getLearnArticle(articleId, { signal }),
  });

  const progressMutation = useMutation({
    mutationFn: (progressRatio: number) => updateLearnProgress(articleId, { progressRatio }),
    onSuccess: (progress) => {
      lastReportedRatio.current = progress.progressRatio;
      queryClient.setQueryData(learnQueryKey.article(articleId), (current) =>
        current ? { ...current, progress } : current,
      );
      void queryClient.invalidateQueries({ queryKey: learnQueryKey.today() });
    },
  });

  useEffect(() => {
    if (!articleQuery.data) {
      return;
    }
    lastReportedRatio.current = articleQuery.data.progress.progressRatio;

    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const ratio = scrollable <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      if (ratio <= lastReportedRatio.current) {
        return;
      }
      if (ratio - lastReportedRatio.current < 5 && ratio < 100) {
        return;
      }
      lastReportedRatio.current = ratio;
      progressMutation.mutate(ratio);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
    // progressMutation identity changes; only rebind when article loads
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [articleQuery.data?.id]);

  const article = articleQuery.data;
  const isNotFound = articleQuery.error instanceof ApiRequestError && articleQuery.error.status === 404;

  if (articleQuery.isPending) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">正在打开阅读…</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>找不到这篇文章</EmptyTitle>
            <EmptyDescription>它可能已下架，或链接不正确。回今日或图书馆再挑一篇吧。</EmptyDescription>
          </EmptyHeader>
          <Button
            nativeButton={false}
            className="mt-6 h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            回今日
          </Button>
        </Empty>
      </div>
    );
  }

  if (articleQuery.isError || !article) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>暂时打不开</EmptyTitle>
            <EmptyDescription>{formatLearnApiError(articleQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const paragraphs = paragraphsFromBody(article.body);
  const levelLabel = LEVEL_LABEL[article.level];
  const metaParts = [
    levelLabel,
    article.estimatedMinutes != null ? `约 ${article.estimatedMinutes} 分钟` : null,
  ].filter(Boolean);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-5 md:px-8">
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-10 shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
            返回
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{article.title}</p>
            <p className="truncate text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
          </div>
        </div>
      </header>

      <main className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 flex-1 px-5 py-10 md:px-8 md:py-14">
        <article className="mx-auto max-w-3xl">
          <p className="mb-6 text-sm tracking-wide text-brand-deep">阅读</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {article.title}
          </h1>

          <div className="mt-10 flex max-w-[42rem] flex-col gap-7 text-lg leading-loose text-foreground/90">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
            ) : (
              <p className="text-muted-foreground">这篇还没有正文。</p>
            )}
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            读到这里也行。不必一次读完——想练几道小题，或先回今日都可以。
          </p>
        </article>
      </main>

      <footer className="sticky bottom-0 border-t border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4 md:px-8">
          {article.practiceAvailable ? (
            <Button
              nativeButton={false}
              variant="outline"
              className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
              render={<Link href={AUTH_ROUTES.learnPractice(articleId)} />}
            >
              <CheckIcon className="size-4" strokeWidth={1.5} aria-hidden />
              练几道小题
            </Button>
          ) : null}
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            先这样，回今日
          </Button>
        </div>
      </footer>
    </div>
  );
}
