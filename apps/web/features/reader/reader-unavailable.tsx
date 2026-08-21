'use client';

import { BookOpenIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { APP_NAME, AUTH_ROUTES } from '@/constants';
import { getReaderUnavailableSuggestions } from '@/features/reader/reader-mock';
import { cn } from '@/lib/utils';

type ReaderUnavailableProps = {
  onRetry?: () => void;
};

export function ReaderUnavailable({ onRetry }: ReaderUnavailableProps) {
  const router = useRouter();
  const suggestions = getReaderUnavailableSuggestions();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-center border-b border-border/40">
        <p className="font-heading text-sm font-semibold tracking-wide text-foreground">{APP_NAME}</p>
      </header>

      <main
        className={cn(
          'mx-auto flex w-full max-w-reading-column flex-1 flex-col items-center px-6 pt-24 pb-16 text-center md:pt-32',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
        )}
      >
        <BookOpenIcon className="mb-6 size-20 text-muted-foreground/45 md:size-24" strokeWidth={1} aria-hidden />
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[32px] md:leading-10">
          无法打开这本书
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">当前无法获取书籍内容，请稍后再试。</p>

        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
          <Button
            type="button"
            className="h-11 rounded-xl px-8 hover:bg-brand-deep active:scale-[0.98]"
            onClick={() => {
              onRetry?.();
              router.refresh();
            }}
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

        <section className="mt-16 w-full text-left">
          <h2 className="font-heading text-lg font-semibold text-foreground">你也可以阅读这些内容</h2>
          <ul className="mt-6 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
            {suggestions.map((item) => (
              <li key={item.id} className="w-40 shrink-0 md:w-auto">
                <Link
                  href={AUTH_ROUTES.readBook(item.id)}
                  className="block rounded-2xl bg-paper p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="aspect-[3/4] rounded-xl bg-surface-container-high" aria-hidden />
                  <p className="font-heading mt-3 line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.author}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
