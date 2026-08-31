'use client';

import type { MouseEvent, ReactNode, UIEvent } from 'react';

import { ReadingPartView } from '@/features/content/reading-part-view';
import type { ReaderFontSize } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderPartProps = {
  title: string;
  partId: string;
  html: string;
  fontSize: ReaderFontSize;
  aiDrawerOpen: boolean;
  tocOpen?: boolean;
  onSelectText: (payload: { quote: string; paragraphId: string; top: number; left: number }) => void;
  onCenterTap: () => void;
  onScroll: (event: UIEvent<HTMLElement>) => void;
  footer?: ReactNode;
};

/** Paragraph id from the server-injected data-p ordinal. */
function paragraphIdFromElement(el: HTMLElement | null, partId: string, fallback: string): string {
  const dataP = el?.getAttribute('data-p');
  if (dataP) {
    return `${partId}-p${Number(dataP) + 1}`;
  }
  return fallback;
}

export function ReaderPart({
  title,
  partId,
  html,
  fontSize,
  aiDrawerOpen,
  tocOpen = false,
  onSelectText,
  onCenterTap,
  onScroll,
  footer,
}: ReaderPartProps) {
  function handleMouseUp(event: MouseEvent<HTMLElement>) {
    const selection = window.getSelection();
    const quote = selection?.toString().trim() ?? '';
    if (!quote || quote.length < 2) {
      return;
    }

    const paragraphEl = (event.target as HTMLElement).closest('[data-p]') as HTMLElement | null;
    const paragraphId = paragraphIdFromElement(paragraphEl, partId, `${partId}-p1`);
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

  function handleContentClick(event: MouseEvent<HTMLElement>) {
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
        aiDrawerOpen && 'md:pr-96',
        tocOpen && 'md:ml-80',
      )}
      onScroll={onScroll}
      onClick={handleContentClick}
    >
      <ReadingPartView title={title} html={html} fontSize={fontSize} onArticleMouseUp={handleMouseUp} footer={footer} />
    </div>
  );
}

export function ReaderPartSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-reading-column flex-col gap-8 px-6 py-24 md:px-8">
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
