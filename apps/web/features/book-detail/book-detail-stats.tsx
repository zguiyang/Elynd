import { StarIcon } from 'lucide-react';

import type { BookDetail } from '@/features/book-detail/book-detail-model';
import { formatMinutes, formatWordCount, levelMeta, levelStarCount } from '@/features/book-detail/book-detail-model';
import { cn } from '@/lib/utils';

const STAR_TOTAL = 5;

export function BookDetailStats({ book }: { book: BookDetail }) {
  const filled = levelStarCount(book.level);
  const levelLabel = levelMeta(book.level);

  return (
    <section className="border-y border-border/50 py-6 md:py-8">
      <h2 className="font-heading mb-4 text-xl font-semibold text-foreground md:hidden">阅读信息</h2>
      <div className="mx-auto grid max-w-reading-column grid-cols-3 divide-x divide-border/50 text-center">
        <div className="px-2 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">难度等级</p>
          <div
            className="mt-1 flex items-center justify-center gap-0.5"
            role="img"
            aria-label={`难度 ${levelLabel}，${filled} 星（共 ${STAR_TOTAL} 星）`}
          >
            {Array.from({ length: STAR_TOTAL }, (_, i) => {
              const isFilled = i < filled;
              return (
                <StarIcon
                  key={i}
                  className={cn(
                    'size-4 md:size-[18px]',
                    isFilled ? 'fill-primary text-primary' : 'fill-muted text-muted',
                  )}
                  strokeWidth={1.25}
                  aria-hidden
                />
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{levelLabel}</p>
        </div>
        <div className="px-2 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            预计阅读时间
          </p>
          <p className="mt-1 text-base font-semibold text-foreground md:text-lg">
            {formatMinutes(book.estimatedMinutes)}
          </p>
        </div>
        <div className="px-2 md:px-4">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">总字数</p>
          <p className="mt-1 text-base font-semibold text-foreground md:text-lg">~{formatWordCount(book.wordCount)}</p>
        </div>
      </div>
    </section>
  );
}
