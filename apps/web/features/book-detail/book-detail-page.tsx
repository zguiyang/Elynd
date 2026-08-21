'use client';

import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AUTH_ROUTES } from '@/constants';
import { BookDetailAbout } from '@/features/book-detail/book-detail-about';
import { BookDetailHero, BookDetailMobileProgress, BookDetailStickyCta } from '@/features/book-detail/book-detail-hero';
import { BOOK_DETAIL_DEMO_IDS, getBookDetail, getRelatedBooks } from '@/features/book-detail/book-detail-mock';
import { BookDetailRelated } from '@/features/book-detail/book-detail-related';
import { BookDetailStats } from '@/features/book-detail/book-detail-stats';
import { BookDetailToc } from '@/features/book-detail/book-detail-toc';
import { BookDetailUnavailable } from '@/features/book-detail/book-detail-unavailable';
import { cn } from '@/lib/utils';

/**
 * Book detail UI prototype: local mock catalog only (no library/shelf API).
 * Reading CTAs route to the existing Reader; shelf add is toast-only.
 */
export function BookDetailPage({ bookId }: { bookId: string }) {
  const book = getBookDetail(bookId);
  const [isShelfOverride, setIsShelfOverride] = useState<boolean | null>(null);

  if (!book || bookId === BOOK_DETAIL_DEMO_IDS.unavailable) {
    return <BookDetailUnavailable />;
  }

  const isOnShelf = isShelfOverride ?? book.shelfStatus === 'on_shelf';
  const related = getRelatedBooks(book);

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col gap-8 pb-28 md:gap-14 md:pb-8',
      )}
    >
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

      <div className="md:hidden">
        <Link
          href={AUTH_ROUTES.library}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 ease-out-soft hover:text-primary"
        >
          <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
          返回发现
        </Link>
      </div>

      <BookDetailHero book={book} onShelf={isOnShelf} onAddToShelf={() => setIsShelfOverride(true)} />
      <BookDetailMobileProgress book={book} />
      <div className="flex flex-col gap-8 md:gap-14">
        <div className="order-1">
          <BookDetailStats book={book} />
        </div>
        <div className="order-3 md:order-2">
          <BookDetailAbout book={book} />
        </div>
        <div className="order-2 md:order-3">
          <BookDetailToc book={book} />
        </div>
        <div className="order-4">
          <BookDetailRelated books={related} />
        </div>
      </div>

      <footer className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
        <p className="mb-1">Gloaming — The Quiet Art of Slow Reading.</p>
        <p className="text-xs tracking-wide uppercase opacity-70">Editorial Preview</p>
      </footer>

      <BookDetailStickyCta book={book} onShelf={isOnShelf} onAddToShelf={() => setIsShelfOverride(true)} />
    </div>
  );
}
