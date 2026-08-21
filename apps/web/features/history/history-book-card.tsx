'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

import { AUTH_ROUTES } from '@/constants';
import { formatHistoryDate, type HistoryWork } from '@/features/history/history-mock';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/library/library-model';
import { cn } from '@/lib/utils';

export function HistoryBookCard({ work }: { work: HistoryWork }) {
  const tint = coverTintForVolume(work.themes, work.title);
  const levelLabel = LEVEL_LABEL[work.level] ?? work.level;
  const isCompleted = work.status === 'completed';
  const href = AUTH_ROUTES.readBook(work.id);

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 border-b border-border/50 py-5 outline-none md:gap-6 md:py-6',
        'transition-colors duration-300 ease-out-soft',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      <div
        className={cn(
          'relative h-24 w-16 shrink-0 overflow-hidden rounded-md shadow-card ring-1 ring-foreground/5',
          tint,
        )}
      >
        <div className="absolute inset-0 flex flex-col justify-end p-2">
          <p className="font-heading line-clamp-3 text-[10px] font-bold leading-snug text-foreground/85">
            {work.title}
          </p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-heading truncate text-lg font-semibold text-foreground transition-colors duration-300 ease-out-soft group-hover:text-primary md:text-2xl md:leading-8">
          {work.title}
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{work.author}</p>

        {/* Desktop meta */}
        <div className="mt-2 hidden gap-4 md:flex">
          {work.minutesReadLabel ? (
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {work.minutesReadLabel}
            </span>
          ) : null}
          {work.lookups != null ? (
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {work.lookups} Lookups
            </span>
          ) : null}
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">{levelLabel}</span>
        </div>

        {/* Mobile: date / progress */}
        <p className="mt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:hidden">
          {isCompleted && work.completedAt
            ? `读完于 ${formatHistoryDate(work.completedAt)}`
            : `已读 ${work.progressRatio}% · 最近 ${formatHistoryDate(work.lastReadAt)}`}
        </p>

        {!isCompleted ? (
          <div className="mt-2 h-0.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-muted md:mt-3">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-soft"
              style={{ width: `${Math.min(100, work.progressRatio)}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Desktop status */}
      <div className="hidden shrink-0 flex-col items-end gap-1 text-right md:flex">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {isCompleted ? 'Finished' : `已读 ${work.progressRatio}%`}
        </span>
        <span className="text-sm text-muted-foreground">
          {isCompleted && work.completedAt ? formatHistoryDate(work.completedAt) : formatHistoryDate(work.lastReadAt)}
        </span>
      </div>

      <ChevronRightIcon
        className="size-5 shrink-0 text-muted-foreground/50 transition-colors duration-300 ease-out-soft group-hover:text-primary md:hidden"
        strokeWidth={1.5}
        aria-hidden
      />
    </Link>
  );
}
