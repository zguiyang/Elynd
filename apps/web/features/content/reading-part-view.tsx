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
 * Outer article is chrome (column width + padding); `.reading-body` is a
 * scoped document-flow surface — spacing comes from content tags, not flex gap.
 */
export function ReadingPartView({ html, fontSize = 'md', className, onArticleMouseUp, footer }: ReadingPartViewProps) {
  const sanitizedHtml = DOMPurify.sanitize(html);

  return (
    <article
      onMouseUp={onArticleMouseUp}
      className={cn(
        // Readest-aligned page insets: 16/20 L-R, compact top; large pb clears TTS/chrome.
        'mx-auto w-full max-w-reading-column px-4 pb-24 pt-6 md:px-5 md:pt-8',
        FONT_CLASS[fontSize],
        className,
      )}
    >
      <div
        className="reading-body font-reading text-foreground/90 text-pretty selection:bg-accent selection:text-brand-deep"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {footer}
    </article>
  );
}
