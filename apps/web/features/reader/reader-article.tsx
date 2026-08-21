'use client';

import type { MouseEvent } from 'react';

import type { ReaderChapterBody, ReaderChapterMeta, ReaderFontSize } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

const FONT_CLASS: Record<ReaderFontSize, string> = {
  sm: 'text-lg leading-8 md:text-[18px] md:leading-8',
  md: 'text-[20px] leading-[1.8] md:leading-9',
  lg: 'text-[22px] leading-9 md:text-2xl md:leading-10',
};

type ReaderArticleProps = {
  bookTitle: string;
  chapter: ReaderChapterBody;
  chapters: ReaderChapterMeta[];
  fontSize: ReaderFontSize;
  tocOpen: boolean;
  aiDrawerOpen: boolean;
  onSelectText: (payload: { quote: string; paragraphId: string; top: number; left: number }) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onCenterTap: () => void;
};

export function ReaderArticle({
  bookTitle,
  chapter,
  chapters,
  fontSize,
  tocOpen,
  aiDrawerOpen,
  onSelectText,
  onPrevChapter,
  onNextChapter,
  onCenterTap,
}: ReaderArticleProps) {
  const chapterIndex = chapters.findIndex((c) => c.id === chapter.id);
  const hasPrev = chapterIndex > 0;
  const hasNext = chapterIndex >= 0 && chapterIndex < chapters.length - 1;
  const nextChapter = hasNext ? chapters[chapterIndex + 1] : null;

  function handleMouseUp(event: MouseEvent<HTMLElement>) {
    const selection = window.getSelection();
    const quote = selection?.toString().trim() ?? '';
    if (!quote || quote.length < 2) {
      return;
    }

    const paragraphEl = (event.target as HTMLElement).closest('[data-paragraph-id]');
    const paragraphId = paragraphEl?.getAttribute('data-paragraph-id') ?? chapter.paragraphs[0]?.id ?? '';
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    if (!rect) return;

    onSelectText({
      quote,
      paragraphId,
      top: rect.bottom + 8,
      left: Math.min(Math.max(16, rect.left + rect.width / 2), window.innerWidth - 16),
    });
  }

  function handleArticleClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [data-reader-ui]')) return;

    const y = event.clientY / window.innerHeight;
    const x = event.clientX / window.innerWidth;
    if (y > 0.2 && y < 0.8 && x > 0.15 && x < 0.85) {
      const selection = window.getSelection()?.toString().trim();
      if (selection) return;
      onCenterTap();
    }
  }

  return (
    <div
      className={cn(
        'relative h-full flex-1 overflow-y-auto transition-[margin,padding] duration-300 ease-out-soft',
        tocOpen && 'md:ml-80',
        aiDrawerOpen && 'md:pr-96',
      )}
      onClick={handleArticleClick}
    >
      <article
        className={cn(
          'mx-auto flex w-full max-w-reading-column flex-col px-6 pb-32 pt-20 md:px-8 md:pt-28',
          FONT_CLASS[fontSize],
        )}
        onMouseUp={handleMouseUp}
      >
        <header className="mb-12 flex flex-col items-center text-center md:mb-16">
          <p className="mb-3 text-xs font-semibold tracking-[0.05em] text-muted-foreground uppercase">{bookTitle}</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.15]">
            {chapter.title}
          </h1>
          <div className="mt-8 h-px w-12 bg-outline/50" aria-hidden />
        </header>

        <div className="font-reading flex flex-col gap-8 text-foreground/90 text-pretty selection:bg-accent selection:text-brand-deep">
          {chapter.paragraphs.map((p) => (
            <p key={p.id} data-paragraph-id={p.id} className="text-justify">
              {p.text}
            </p>
          ))}
        </div>

        <section
          data-reader-ui
          className="mt-16 flex flex-col items-center justify-center border-t border-border/40 pt-16 pb-8 text-center md:mt-32"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-4 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Up Next</p>
          {nextChapter ? (
            <h2 className="font-heading text-2xl font-semibold text-primary md:text-[32px] md:leading-10">
              {nextChapter.title}
            </h2>
          ) : (
            <h2 className="font-heading text-2xl font-semibold text-primary md:text-[32px] md:leading-10">
              本书已读完
            </h2>
          )}
          <div className="mt-12 flex w-full max-w-sm items-center justify-between gap-6">
            <button
              type="button"
              disabled={!hasPrev}
              className={cn(
                'group flex items-center gap-2 text-sm text-muted-foreground transition-colors',
                hasPrev ? 'hover:text-primary' : 'cursor-not-allowed opacity-40',
              )}
              onClick={onPrevChapter}
            >
              <span aria-hidden className={cn(hasPrev && 'transition-transform group-hover:-translate-x-0.5')}>
                ←
              </span>
              Previous Chapter
            </button>
            <button
              type="button"
              className="group flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-brand-deep"
              onClick={onNextChapter}
            >
              {hasNext ? 'Continue Reading' : '返回书架'}
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </button>
          </div>
        </section>
      </article>
    </div>
  );
}

export function ReaderArticleSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-reading-column flex-col gap-8 px-6 py-24 md:px-8">
      <div className="mx-auto h-3 w-40 animate-pulse rounded bg-surface-container-high" />
      <div className="mx-auto h-10 w-3/4 max-w-md animate-pulse rounded-lg bg-surface-container-high" />
      <div className="mx-auto mt-4 h-px w-12 bg-border/60" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-5 animate-pulse rounded bg-surface-container-high"
            style={{ width: `${88 - (i % 3) * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
