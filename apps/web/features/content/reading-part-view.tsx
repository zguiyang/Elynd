'use client';

import DOMPurify from 'dompurify';
import type { MouseEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ReadingPartFontSize = 'sm' | 'md' | 'lg';

const FONT_CLASS: Record<ReadingPartFontSize, string> = {
  sm: 'text-lg leading-8 md:text-[18px] md:leading-8',
  md: 'text-[20px] leading-[1.8] md:leading-9',
  lg: 'text-[22px] leading-9 md:text-2xl md:leading-10',
};

type ReadingPartViewProps = {
  title: string;
  html: string;
  fontSize?: ReadingPartFontSize;
  className?: string;
  /** Optional selection handling — the learner Reader wires its assist toolbar here. */
  onArticleMouseUp?: (event: MouseEvent<HTMLElement>) => void;
  /** Optional content after the reading body (e.g. the learner's chapter-end footer). */
  footer?: ReactNode;
};

/**
 * Pure reading typography shared by the learner Reader and the admin preview —
 * the single place that renders normalized reading HTML in a reading column.
 */
export function ReadingPartView({
  title,
  html,
  fontSize = 'md',
  className,
  onArticleMouseUp,
  footer,
}: ReadingPartViewProps) {
  const sanitizedHtml = DOMPurify.sanitize(html);

  return (
    <article
      onMouseUp={onArticleMouseUp}
      className={cn(
        'mx-auto flex w-full max-w-reading-column flex-col px-6 pb-32 pt-20 md:px-8 md:pt-28',
        FONT_CLASS[fontSize],
        className,
      )}
    >
      <header className="mb-12 flex flex-col items-center text-center md:mb-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.15]">
          {title}
        </h1>
        <div className="mt-8 h-px w-12 bg-outline/50" aria-hidden />
      </header>

      <div
        className="reading-body font-reading flex flex-col gap-8 text-foreground/90 text-pretty selection:bg-accent selection:text-brand-deep"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {footer}
    </article>
  );
}
