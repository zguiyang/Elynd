'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  HeadphonesIcon,
  LightbulbIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { formatLearnApiError, getLearnArticle, learnQueryKey, updateLearnProgress } from '@/features/learn/learn-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

const ASSIST_OPEN_STORAGE_KEY = 'elynd.learn.assistOpen';

type LearnRoomPageProps = {
  articleId: string;
};

function readAssistOpenPreference(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const raw = window.localStorage.getItem(ASSIST_OPEN_STORAGE_KEY);
  if (raw === null) {
    return true;
  }
  return raw === '1';
}

function subscribeAssistOpen(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function writeAssistOpenPreference(next: boolean) {
  window.localStorage.setItem(ASSIST_OPEN_STORAGE_KEY, next ? '1' : '0');
  window.dispatchEvent(new Event('storage'));
}

function progressCaption(ratio: number): string {
  if (ratio < 15) {
    return '刚开始 · 不必一次读完';
  }
  if (ratio < 45) {
    return '读了一小段 · 不必一次读完';
  }
  if (ratio < 70) {
    return '大约一半 · 不必一次读完';
  }
  if (ratio < 95) {
    return '快到结尾了 · 不必一次读完';
  }
  return '这篇差不多了 · 想停也可以';
}

function toastComingSoon(feature: string) {
  toast.message(`${feature}稍后开放`, {
    description: '先安心读正文就好。',
  });
}

/**
 * Learning Room — calm editorial reader with collapsible assist rail (UI placeholders for TTS / assist).
 */
export function LearnRoomPage({ articleId }: LearnRoomPageProps) {
  const queryClient = useQueryClient();
  const lastReportedRatio = useRef(0);
  const readingScrollRef = useRef<HTMLElement | null>(null);
  const isAssistOpen = useSyncExternalStore(subscribeAssistOpen, readAssistOpenPreference, () => true);

  function setAssistOpen(next: boolean) {
    writeAssistOpenPreference(next);
  }

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
    const scroller = readingScrollRef.current;
    if (!scroller) {
      return;
    }

    function onScroll() {
      if (!scroller) {
        return;
      }
      const scrollable = scroller.scrollHeight - scroller.clientHeight;
      const ratio = scrollable <= 0 ? 100 : Math.min(100, Math.round((scroller.scrollTop / scrollable) * 100));
      if (ratio <= lastReportedRatio.current) {
        return;
      }
      if (ratio - lastReportedRatio.current < 5 && ratio < 100) {
        return;
      }
      lastReportedRatio.current = ratio;
      progressMutation.mutate(ratio);
    }

    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener('scroll', onScroll);
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
  const focusSentence = paragraphs[0] ?? article.title;
  const progressRatio = article.progress.progressRatio;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="z-30 shrink-0 border-b border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="flex h-16 items-center gap-3 px-4 md:gap-4 md:px-6 lg:px-8">
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-10 shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
            返回
          </Button>
          <div className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{article.title}</p>
            <p className="truncate text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="听读（稍后开放）"
              onClick={() => toastComingSoon('听读')}
            >
              <HeadphonesIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="书签（稍后开放）"
              onClick={() => toastComingSoon('书签')}
            >
              <BookmarkIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
            {!isAssistOpen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="展开帮助"
                onClick={() => setAssistOpen(true)}
              >
                <PanelRightOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <section ref={readingScrollRef} className="min-w-0 flex-1 overflow-y-auto px-5 py-10 md:px-8 md:py-14 lg:px-12">
          <article
            className={cn(
              'mx-auto transition-[max-width] duration-300 ease-out-soft',
              isAssistOpen ? 'max-w-3xl' : 'max-w-3xl lg:max-w-4xl',
            )}
          >
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

            <div className="mt-14 rounded-3xl bg-paper px-5 py-5 md:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-foreground/5">
                    <HeadphonesIcon className="size-4 text-brand-deep" strokeWidth={1.5} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">听读 · 稍后开放</p>
                    <p className="text-xs text-muted-foreground">先读文字就很好</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">占位</p>
              </div>
            </div>

            <p className="mt-10 text-sm text-muted-foreground">
              读到这里也行。不必一次读完——想练几道小题，或先回今日都可以。
            </p>
          </article>
        </section>

        {isAssistOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-foreground/20 lg:hidden"
              aria-label="关闭帮助"
              onClick={() => setAssistOpen(false)}
            />
            <AssistRail
              className={cn(
                'z-20 flex w-[min(22.5rem,100%)] shrink-0 flex-col border-l border-border bg-sidebar',
                'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-card',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-300',
              )}
              focusSentence={focusSentence}
              progressRatio={progressRatio}
              onClose={() => setAssistOpen(false)}
            />
          </>
        ) : null}
      </div>

      <footer className="z-30 shrink-0 border-t border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4 md:px-8">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
            onClick={() => toastComingSoon('听读')}
          >
            <HeadphonesIcon className="size-4" strokeWidth={1.5} aria-hidden />
            听一听
          </Button>
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
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
              disabled
              title="这篇还没有练习题"
            >
              <CheckIcon className="size-4" strokeWidth={1.5} aria-hidden />
              练几道小题
            </Button>
          )}
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            先这样，回今日
          </Button>
        </div>
      </footer>

      {!isAssistOpen ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            'fixed right-5 z-40 h-12 gap-2 rounded-2xl border-border bg-card px-4 shadow-card',
            'bottom-[5.75rem] sm:bottom-24',
            'transition-colors duration-300 ease-out-soft hover:bg-muted/40',
          )}
          aria-label="展开帮助"
          onClick={() => setAssistOpen(true)}
        >
          <LightbulbIcon className="size-4 text-brand-deep" strokeWidth={1.5} aria-hidden />
          <span className="text-sm font-medium">帮助</span>
        </Button>
      ) : null}
    </div>
  );
}

function AssistRail({
  className,
  focusSentence,
  progressRatio,
  onClose,
}: {
  className?: string;
  focusSentence: string;
  progressRatio: number;
  onClose: () => void;
}) {
  return (
    <aside className={className} aria-label="阅读帮助">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">卡住时再看</p>
          <p className="mt-0.5 text-xs text-muted-foreground">查词、看解释，然后继续读</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
          aria-label="收起帮助"
          onClick={onClose}
        >
          <PanelRightCloseIcon className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="rounded-3xl border border-border bg-card p-5 md:p-6">
          <p className="text-sm text-muted-foreground">当前句子</p>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-foreground">{focusSentence}</p>
          <div className="mt-5 space-y-2.5">
            {(['这句话什么意思', '用更简单的英语说', '这个词在文中指什么'] as const).map((label) => (
              <button
                key={label}
                type="button"
                className={cn(
                  'w-full rounded-xl bg-muted/60 px-4 py-3.5 text-left text-sm text-foreground',
                  'transition-colors duration-300 ease-out-soft hover:bg-muted',
                )}
                onClick={() => toastComingSoon('文内解释')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">功能稍后开放 · 先继续读也很好</p>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm text-muted-foreground">读到这里也行</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-soft"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{progressCaption(progressRatio)}</p>
        </div>
      </div>
    </aside>
  );
}
