'use client';

import { BookOpenIcon, CheckIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { coverTintForVolume } from '@/features/content/content-model';
import type { DiscoverItem, DiscoverShelfStatus } from '@/features/discover/discover-model';
import { cn } from '@/lib/utils';

type DiscoverBookCardProps = {
  item: DiscoverItem;
  onAddToShelf: (id: string) => void;
  addingId?: string;
};

function Cover({
  item,
  shelfStatus,
  className,
}: {
  item: DiscoverItem;
  shelfStatus: DiscoverShelfStatus;
  className?: string;
}) {
  const tint = coverTintForVolume(item.tags, item.title);
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const canShowImage = Boolean(item.coverImageUrl) && !hasImageFailed;
  const progress =
    shelfStatus === 'in_progress' && item.progressRatio != null && item.progressRatio > 0 ? item.progressRatio : null;

  return (
    <div className={cn('relative overflow-hidden', !canShowImage && tint, className)}>
      {canShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- same asset URL pattern as BookDetailCover
        <img
          src={item.coverImageUrl!}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setHasImageFailed(true)}
        />
      ) : null}
      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-between p-3 md:p-6',
          canShowImage && 'bg-gradient-to-t from-foreground/60 via-foreground/15 to-transparent',
        )}
      >
        <span className="self-end rounded-sm border border-border/25 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase shadow-sm">
          {item.sourceLabel}
        </span>
        <p
          className={cn(
            'font-heading line-clamp-4 text-[13px] font-bold leading-snug tracking-tight md:text-xl md:leading-snug',
            canShowImage ? 'text-background drop-shadow-sm' : 'text-foreground',
          )}
        >
          {item.title}
        </p>
      </div>
      {progress != null ? (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ShelfAction({
  status,
  progressRatio,
  readHref,
  onAdd,
  compact,
  isAdding,
}: {
  status: DiscoverShelfStatus;
  progressRatio: number | null;
  readHref: string;
  onAdd: () => void;
  compact?: boolean;
  isAdding?: boolean;
}) {
  if (status === 'in_progress') {
    return (
      <div className="flex items-center gap-2">
        <Button
          nativeButton={false}
          variant="secondary"
          className={cn(
            'rounded-lg bg-muted text-foreground shadow-none hover:bg-surface-container-highest',
            compact ? 'h-8 px-3 text-[13px]' : 'h-9 rounded-full px-4 text-sm',
          )}
          render={<Link href={readHref} />}
        >
          <BookOpenIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
          继续阅读
        </Button>
        {progressRatio != null ? (
          <span className="text-[11px] font-medium tracking-wide text-primary">{progressRatio}%</span>
        ) : null}
      </div>
    );
  }

  if (status === 'on_shelf') {
    return (
      <Button
        type="button"
        variant="secondary"
        disabled
        className={cn(
          'cursor-default gap-1 bg-surface-container-high text-muted-foreground shadow-none disabled:opacity-100',
          compact ? 'h-8 rounded-lg px-3 text-[13px]' : 'h-9 rounded-full px-4 text-sm',
        )}
      >
        <CheckIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
        已在书架
      </Button>
    );
  }

  return (
    <Button
      type="button"
      disabled={isAdding}
      className={cn(
        'hover:bg-brand-deep active:scale-[0.98]',
        compact ? 'h-8 rounded-lg px-3 text-[13px]' : 'h-9 rounded-full px-4 text-sm shadow-sm',
      )}
      onClick={onAdd}
    >
      {isAdding ? <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> : null}
      加入书架
    </Button>
  );
}

export function DiscoverBookCard({ item, onAddToShelf, addingId }: DiscoverBookCardProps) {
  const detailHref = AUTH_ROUTES.bookDetail(item.id);
  const readHref = AUTH_ROUTES.readBook(item.id);
  const isAdding = addingId === item.id;
  const hasCopy = Boolean(item.author || item.teaser);

  return (
    <article
      className={cn(
        'group flex gap-4 rounded-2xl bg-paper p-4 transition-transform duration-300 ease-out-soft',
        'md:flex-col md:gap-0 md:overflow-hidden md:p-0',
        'md:hover:-translate-y-1',
      )}
    >
      <Link
        href={detailHref}
        className="shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:block"
        aria-label={`查看《${item.title}》详情`}
      >
        <Cover
          item={item}
          shelfStatus={item.shelfStatus}
          className="aspect-[2/3] w-24 rounded-lg md:aspect-[3/4] md:w-full md:rounded-none"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 md:flex-grow md:bg-paper md:p-6">
        {hasCopy ? (
          <Link href={detailHref} className="group/copy outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {item.author ? (
              <p className="font-heading text-[13px] leading-snug font-medium tracking-wide text-muted-foreground italic transition-colors duration-200 ease-out-soft group-hover/copy:text-primary md:text-[15px] md:leading-6">
                {item.author}
              </p>
            ) : null}
            {item.teaser ? (
              <p
                className={cn(
                  'font-reading text-[13px] font-normal leading-5 text-foreground/65',
                  'line-clamp-3 md:line-clamp-4 md:text-sm md:leading-6',
                  item.author ? 'mt-2 md:mt-2.5' : '',
                )}
              >
                {item.teaser}
              </p>
            ) : null}
          </Link>
        ) : null}

        <div className={cn('flex items-center md:hidden', hasCopy ? 'mt-3' : '')}>
          <ShelfAction
            status={item.shelfStatus}
            progressRatio={item.progressRatio}
            readHref={readHref}
            onAdd={() => onAddToShelf(item.id)}
            compact
            isAdding={isAdding}
          />
        </div>

        <div className="mt-auto hidden items-center justify-between border-t border-border/30 pt-4 md:flex">
          <Link
            href={detailHref}
            className="text-[13px] font-medium text-muted-foreground/70 transition-colors duration-200 ease-out-soft hover:text-primary"
          >
            查看详情
          </Link>
          <ShelfAction
            status={item.shelfStatus}
            progressRatio={item.progressRatio}
            readHref={readHref}
            onAdd={() => onAddToShelf(item.id)}
            isAdding={isAdding}
          />
        </div>
      </div>
    </article>
  );
}
