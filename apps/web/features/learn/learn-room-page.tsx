import { ArrowLeftIcon, BookOpenIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { getLearnStaticArticle } from '@/features/learn/learn-static-data';

type LearnRoomPageProps = {
  articleId: string;
};

/**
 * Prototype / stub Learning Room — static article only.
 * Assist / TTS intentionally omitted for this pass (design: Q3-A).
 */
export function LearnRoomPage({ articleId }: LearnRoomPageProps) {
  const article = getLearnStaticArticle(articleId);

  if (!article) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>找不到这篇演示文章</EmptyTitle>
            <EmptyDescription>静态预览里只有几篇样例。回今日再点「开始阅读」即可。</EmptyDescription>
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

  const metaParts = [article.levelLabel, `约 ${article.estimatedMinutes} 分钟`];

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
          <p className="mb-6 text-sm tracking-wide text-brand-deep">{article.eyebrow}</p>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {article.titleLines ? (
              <>
                {article.titleLines[0]}
                <br />
                {article.titleLines[1]}
              </>
            ) : (
              article.title
            )}
          </h1>

          <div className="mt-10 flex max-w-[42rem] flex-col gap-7 text-lg leading-loose text-foreground/90">
            {article.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>

          <p className="mt-12 text-sm text-muted-foreground">
            读到这里也行。不必一次读完——想练几道小题，或先回今日都可以。
          </p>
        </article>
      </main>

      <footer className="sticky bottom-0 border-t border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4 md:px-8">
          <Button
            nativeButton={false}
            variant="outline"
            className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
            render={<Link href={AUTH_ROUTES.learnPractice(articleId)} />}
          >
            <CheckIcon className="size-4" strokeWidth={1.5} aria-hidden />
            练几道小题
          </Button>
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
