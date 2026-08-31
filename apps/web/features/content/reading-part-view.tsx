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
 * Chapter title lives in chrome/TOC metadata; the body HTML is the reading surface SSOT.
 */
export function ReadingPartView({ html, fontSize = 'md', className, onArticleMouseUp, footer }: ReadingPartViewProps) {
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
      <div
        className="reading-body font-reading flex flex-col gap-8 text-foreground/90 text-pretty selection:bg-accent selection:text-brand-deep"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {footer}
    </article>
  );
}
