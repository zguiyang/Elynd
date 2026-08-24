'use client';

import { RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

type BookDetailUnavailableProps = {
  message?: string;
};

export function BookDetailUnavailable({ message }: BookDetailUnavailableProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-2 py-16 text-center md:py-24',
      )}
    >
      <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[32px] md:leading-10">
        无法打开这篇文章
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">{message ?? '当前无法获取内容，请稍后再试。'}</p>
      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
        <Button
          type="button"
          className="h-11 rounded-xl px-8 text-sm shadow-sm hover:bg-brand-deep active:scale-[0.98]"
          onClick={() => router.refresh()}
        >
          <RefreshCwIcon className="size-4" strokeWidth={1.5} aria-hidden />
          重新加载
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          className="h-11 rounded-xl border-2 border-outline/60 px-8 text-sm text-muted-foreground hover:bg-surface-container-low"
          render={<Link href={AUTH_ROUTES.discover} />}
        >
          返回发现
        </Button>
      </div>
    </div>
  );
}
