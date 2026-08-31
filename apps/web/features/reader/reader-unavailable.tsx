'use client';

import { BookOpenIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { APP_NAME, AUTH_ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

type ReaderUnavailableProps = {
  onRetry?: () => void;
  message?: string;
};

export function ReaderUnavailable({ onRetry, message }: ReaderUnavailableProps) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-center border-b border-border/40">
        <p className="font-heading text-sm font-semibold tracking-wide text-foreground">{APP_NAME}</p>
      </header>

      <main
        className={cn(
          'mx-auto flex w-full max-w-reading-column flex-1 flex-col items-center px-4 pt-24 pb-16 text-center md:px-5 md:pt-32',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
        )}
      >
        <BookOpenIcon className="mb-6 size-20 text-muted-foreground/45 md:size-24" strokeWidth={1} aria-hidden />
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[32px] md:leading-10">
          无法打开这篇文章
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">{message ?? '当前无法获取内容，请稍后再试。'}</p>

        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
          <Button
            type="button"
            className="h-11 rounded-xl px-8 hover:bg-brand-deep active:scale-[0.98]"
            onClick={onRetry}
          >
            <RefreshCwIcon className="size-4" strokeWidth={1.5} aria-hidden />
            重新加载
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            className="h-11 rounded-xl border-2 border-outline/50 px-8 text-muted-foreground"
            render={<Link href={AUTH_ROUTES.discover} />}
          >
            返回发现
          </Button>
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-11 rounded-xl px-6 text-muted-foreground"
            render={<Link href={AUTH_ROUTES.shelf} />}
          >
            返回书架
          </Button>
        </div>
      </main>
    </div>
  );
}
