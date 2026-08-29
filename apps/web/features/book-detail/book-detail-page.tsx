'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { AUTH_ROUTES } from '@/constants';
import {
  bookDetailQueryKey,
  formatBookDetailApiError,
  useBookDetailQuery,
} from '@/features/book-detail/book-detail-api';
import { BookDetailHero, BookDetailMobileProgress, BookDetailStickyCta } from '@/features/book-detail/book-detail-hero';
import {
  BOOK_DETAIL_DEMO_IDS,
  getRelatedBooks,
  isBookDetailDemoId,
  resolveBookDetail,
} from '@/features/book-detail/book-detail-mock';
import type { BookDetail } from '@/features/book-detail/book-detail-model';
import { BookDetailRelated } from '@/features/book-detail/book-detail-related';
import { BookDetailStats } from '@/features/book-detail/book-detail-stats';
import { BookDetailToc } from '@/features/book-detail/book-detail-toc';
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

function BookDetailView({
  book,
  related,
  showDemoChrome,
}: {
  book: BookDetail;
  related: BookDetail[];
  showDemoChrome: boolean;
}) {
  const queryClient = useQueryClient();
  const addToShelf = useAddToShelfMutation();
  const [hasDemoShelfOverride, setHasDemoShelfOverride] = useState(false);
  const isOnShelf = showDemoChrome
    ? hasDemoShelfOverride || book.shelfStatus === 'on_shelf'
    : book.shelfStatus === 'on_shelf';

  function handleAddToShelf() {
    if (showDemoChrome) {
      setHasDemoShelfOverride(true);
      toast.success('已加入书架（界面预览）');
      return;
    }
    addToShelf.mutate(book.id, {
      onSuccess: async () => {
        toast.success('已加入书架');
        await queryClient.invalidateQueries({ queryKey: bookDetailQueryKey.detail(book.id) });
      },
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
      {showDemoChrome ? (
        <p className="text-center text-xs text-muted-foreground">
          界面预览（假数据）· 状态示例：
          <Link
            href={AUTH_ROUTES.bookDetail(BOOK_DETAIL_DEMO_IDS.unread)}
            className="mx-1 underline-offset-2 hover:text-primary hover:underline"
          >
            未读
          </Link>
          /
          <Link
            href={AUTH_ROUTES.bookDetail(BOOK_DETAIL_DEMO_IDS.inProgress)}
            className="mx-1 underline-offset-2 hover:text-primary hover:underline"
          >
            有进度
          </Link>
          /
          <Link
            href={AUTH_ROUTES.bookDetail(BOOK_DETAIL_DEMO_IDS.completed)}
            className="mx-1 underline-offset-2 hover:text-primary hover:underline"
          >
            已读完
          </Link>
          /
          <Link
            href={AUTH_ROUTES.bookDetail(BOOK_DETAIL_DEMO_IDS.unavailable)}
            className="mx-1 underline-offset-2 hover:text-primary hover:underline"
          >
            无法打开
          </Link>
        </p>
      ) : null}

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
        isAddingToShelf={!showDemoChrome && addToShelf.isPending}
      />
      <BookDetailMobileProgress book={book} />

      <div className="flex flex-col gap-8 md:gap-14">
        <BookDetailStats book={book} />
        <BookDetailToc book={book} />
        <BookDetailRelated books={related} />
      </div>

      <footer className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
        <p className="mb-1">Gloaming — The Quiet Art of Slow Reading.</p>
        {showDemoChrome ? <p className="text-xs tracking-wide uppercase opacity-70">Editorial Preview</p> : null}
      </footer>

      <BookDetailStickyCta
        book={book}
        onShelf={isOnShelf}
        onAddToShelf={handleAddToShelf}
        isAddingToShelf={!showDemoChrome && addToShelf.isPending}
      />
    </div>
  );
}

function BookDetailMockPage({ workId }: { workId: string }) {
  const book = resolveBookDetail(workId);
  if (!book) {
    return <BookDetailUnavailable />;
  }
  return <BookDetailView book={book} related={getRelatedBooks(book)} showDemoChrome />;
}

function BookDetailLivePage({ workId }: { workId: string }) {
  const detailQuery = useBookDetailQuery(workId);

  if (detailQuery.isPending) {
    return <BookDetailSkeleton />;
  }

  if (detailQuery.isError) {
    return <BookDetailUnavailable message={formatBookDetailApiError(detailQuery.error)} />;
  }

  return <BookDetailView book={detailQuery.data.book} related={detailQuery.data.related} showDemoChrome={false} />;
}

/**
 * Book detail: demo ids → Mock UI; published work UUIDs → catalog/shelf/parts hybrid.
 */
export function BookDetailPage({ workId }: { workId: string }) {
  if (isBookDetailDemoId(workId)) {
    return <BookDetailMockPage workId={workId} />;
  }
  return <BookDetailLivePage workId={workId} />;
}
