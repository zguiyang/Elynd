'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  HeadphonesIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { formatLearnApiError, getLearnArticle, learnQueryKey } from '@/features/learn/learn-api';
import { LearnArticleReader } from '@/features/learn/learn-article-reader';
import { LearnHelpRail, type PendingAssist } from '@/features/learn/learn-help-rail';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

const ASSIST_OPEN_STORAGE_KEY = 'elynd.learn.assistOpen';

type LearnRoomPageProps = {
  articleId: string;
};

function readAssistOpenPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const raw = window.localStorage.getItem(ASSIST_OPEN_STORAGE_KEY);
  if (raw === null) {
    return false;
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

function toastComingSoon(feature: string) {
  toast.message(`${feature}即将开放`);
}

/**
 * Learning Room — calm editorial reader with collapsible help rail (SSE assist).
 */
export function LearnRoomPage({ articleId }: LearnRoomPageProps) {
  const isAssistOpen = useSyncExternalStore(subscribeAssistOpen, readAssistOpenPreference, () => false);
  const [pendingAssist, setPendingAssist] = useState<PendingAssist | null>(null);

  function setAssistOpen(next: boolean) {
    writeAssistOpenPreference(next);
  }

  const articleQuery = useQuery({
    queryKey: learnQueryKey.article(articleId),
    queryFn: ({ signal }) => getLearnArticle(articleId, { signal }),
  });

  const article = articleQuery.data;
  const isNotFound = articleQuery.error instanceof ApiRequestError && articleQuery.error.status === 404;

  if (articleQuery.isPending) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">加载中…</p>
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
            <EmptyDescription>可能已下架或链接无效。</EmptyDescription>
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
            <EmptyTitle>暂时无法加载</EmptyTitle>
            <EmptyDescription>{formatLearnApiError(articleQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="z-30 shrink-0 border-b border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6 lg:px-8">
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-10 shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
            返回
          </Button>
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="书签"
              onClick={() => toastComingSoon('书签')}
            >
              <BookmarkIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label={isAssistOpen ? '收起帮助' : '展开帮助'}
              aria-pressed={isAssistOpen}
              onClick={() => setAssistOpen(!isAssistOpen)}
            >
              {isAssistOpen ? (
                <PanelRightCloseIcon className="size-4" strokeWidth={1.5} aria-hidden />
              ) : (
                <PanelRightOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <LearnArticleReader
          title={article.title}
          body={article.body}
          level={article.level}
          estimatedMinutes={article.estimatedMinutes}
          isAssistOpen={isAssistOpen}
          onAssistRequest={(pending) => {
            setAssistOpen(true);
            setPendingAssist(pending);
          }}
        />

        {isAssistOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-foreground/20 lg:hidden"
              aria-label="关闭帮助"
              onClick={() => setAssistOpen(false)}
            />
            <LearnHelpRail
              className={cn(
                'z-20 flex w-[min(28rem,100%)] shrink-0 flex-col border-l border-border bg-sidebar',
                'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-card',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-300',
              )}
              articleId={articleId}
              pendingAssist={pendingAssist}
              onPendingAssistHandled={() => setPendingAssist(null)}
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
            回今日
          </Button>
        </div>
      </footer>
    </div>
  );
}
