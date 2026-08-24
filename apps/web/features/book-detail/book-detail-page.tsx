'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { AUTH_ROUTES } from '@/constants';
import { BookDetailAbout } from '@/features/book-detail/book-detail-about';
import { formatBookDetailApiError, useBookDetailQuery } from '@/features/book-detail/book-detail-api';
import { BookDetailHero, BookDetailMobileProgress, BookDetailStickyCta } from '@/features/book-detail/book-detail-hero';
import { BookDetailStats } from '@/features/book-detail/book-detail-stats';
import { BookDetailUnavailable } from '@/features/book-detail/book-detail-unavailable';
import { useAddToShelfMutation } from '@/features/discover/discover-api';
import { cn } from '@/lib/utils';

function BookDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-8" aria-hidden>
      <div className="h-8 w-32 animate-pulse rounded bg-surface-container-high" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="mx-auto aspect-[2/3] w-48 animate-pulse rounded-sm bg-surface-container-high md:col-span-4" />
        <div className="space-y-4 md:col-span-8">
          <div className="h-10 w-3/4 animate-pulse rounded bg-surface-container-high" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-surface-container-high" />
        </div>
      </div>
    </div>
  );
}

export function BookDetailPage({ articleId }: { articleId: string }) {
  const detailQuery = useBookDetailQuery(articleId);
  const addToShelf = useAddToShelfMutation();

  if (detailQuery.isPending) {
    return <BookDetailSkeleton />;
  }

  if (detailQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <BookDetailUnavailable message={formatBookDetailApiError(detailQuery.error)} />
      </div>
    );
  }

  const book = detailQuery.data;
  const isOnShelf = book.shelfStatus === 'on_shelf';

  function handleAddToShelf() {
    addToShelf.mutate(book.id, {
      onSuccess: () => toast.success('已加入书架'),
      onError: (error) => toast.error(formatBookDetailApiError(error)),
    });
  }

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col gap-8 pb-36 md:gap-14 md:pb-8',
      )}
    >
      <div className="md:hidden">
        <Link
          href={AUTH_ROUTES.discover}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 ease-out-soft hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
          返回发现
        </Link>
      </div>

      <BookDetailHero
        book={book}
        onShelf={isOnShelf}
        onAddToShelf={handleAddToShelf}
        isAddingToShelf={addToShelf.isPending}
      />
      <BookDetailMobileProgress book={book} />
      <div className="flex flex-col gap-8 md:gap-14">
        <BookDetailStats book={book} />
        <BookDetailAbout book={book} />
      </div>

      <footer className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
        <p className="mb-1">Gloaming — The Quiet Art of Slow Reading.</p>
      </footer>

      <BookDetailStickyCta
        book={book}
        onShelf={isOnShelf}
        onAddToShelf={handleAddToShelf}
        isAddingToShelf={addToShelf.isPending}
      />
    </div>
  );
}
