'use client';

import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, PlayIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AUTH_ROUTES } from '@/constants';
import type { BookChapter, BookDetail } from '@/features/book-detail/book-detail-model';
import { chapterOrdinalLabel, chapterStatusLabel } from '@/features/book-detail/book-detail-model';
import { cn } from '@/lib/utils';

/** Desktop prototype shows a short preview then “展开全部章节”. */
const PREVIEW_COUNT = 4;

export function BookDetailToc({ book }: { book: BookDetail }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const chapters = book.chapters;
  const visible = isExpanded ? chapters : chapters.slice(0, PREVIEW_COUNT);
  const canExpand = chapters.length > PREVIEW_COUNT;

  return (
    <section className="mx-auto max-w-reading-column space-y-4 border-t border-border/50 pt-8 md:space-y-6">
      <div className="flex items-end justify-between gap-3 md:mb-2 md:flex-col md:items-center md:justify-center">
        <h2 className="font-heading text-xl font-semibold text-foreground md:text-2xl">目录</h2>
        <span className="text-sm text-muted-foreground">共 {chapters.length} 章</span>
      </div>

      <ul className="space-y-1 md:space-y-2">
        {visible.map((chapter) => (
          <li key={chapter.id}>
            <ChapterRow chapter={chapter} workId={book.id} />
          </li>
        ))}
      </ul>

      {canExpand ? (
        <div className="pt-2 text-center">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors duration-200 ease-out-soft hover:text-brand-deep"
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? '收起章节' : '展开全部章节'}
            <ChevronDownIcon
              className={cn('size-4 transition-transform duration-300 ease-out-soft', isExpanded && 'rotate-180')}
              strokeWidth={1.5}
              aria-hidden
            />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ChapterRow({ chapter, workId }: { chapter: BookChapter; workId: string }) {
  const label = chapterStatusLabel(chapter.status);
  const isCurrent = chapter.status === 'current';
  const isUnread = chapter.status === 'unread';
  const ordinal = chapterOrdinalLabel(chapter.index);
  const href = AUTH_ROUTES.readBook(workId, chapter.id);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-3 py-4 transition-colors duration-200 ease-out-soft md:px-4',
        'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        isCurrent
          ? 'border-primary/20 bg-surface-container shadow-sm'
          : 'border-transparent hover:border-border/50 hover:bg-surface-container-low',
        isUnread && 'opacity-80',
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <ChapterIcon status={chapter.status} />
        <div className="min-w-0">
          <p
            className={cn(
              'truncate text-sm font-medium transition-colors duration-200 ease-out-soft md:text-base',
              isCurrent ? 'text-primary' : 'text-foreground',
            )}
          >
            <span className="text-muted-foreground">{ordinal}</span>
            <span className="mx-1.5 text-border" aria-hidden>
              ·
            </span>
            {chapter.title}
          </p>
          {chapter.estimatedMinutes != null && chapter.wordCount != null ? (
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
              ~{chapter.estimatedMinutes} 分钟 · {chapter.wordCount.toLocaleString('en-US')} 字
            </p>
          ) : null}
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 text-xs tracking-wide',
          isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </Link>
  );
}

function ChapterIcon({ status }: { status: BookChapter['status'] }) {
  if (status === 'read') {
    return (
      <CheckCircle2Icon className="size-5 shrink-0 fill-primary/15 text-primary/70" strokeWidth={1.5} aria-hidden />
    );
  }
  if (status === 'current') {
    return (
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
        <CircleIcon className="absolute inset-0 size-5 fill-primary text-primary" strokeWidth={0} />
        <PlayIcon
          className="relative size-2.5 translate-x-px fill-primary-foreground text-primary-foreground"
          strokeWidth={0}
        />
      </span>
    );
  }
  return <CircleIcon className="size-5 shrink-0 text-muted-foreground/45" strokeWidth={1.5} aria-hidden />;
}
