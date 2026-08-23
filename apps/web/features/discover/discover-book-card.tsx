'use client';

import { BookOpenIcon, CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/content/content-model';
import type { DiscoverItem, DiscoverShelfStatus } from '@/features/discover/discover-mock';
import { cn } from '@/lib/utils';

type DiscoverBookCardProps = {
  item: DiscoverItem;
  shelfStatus: DiscoverShelfStatus;
  onAddToShelf: (id: string) => void;
};

function metaLine(item: DiscoverItem): string {
  const themes = item.themes.slice(0, 2).join(' · ');
  return themes ? `${themes} · ${item.category}` : item.category;
}

function Cover({
  item,
  shelfStatus,
  className,
}: {
  item: DiscoverItem;
  shelfStatus: DiscoverShelfStatus;
  className?: string;
}) {
  const tint = coverTintForVolume(item.themes, item.title);
  const progress =
    shelfStatus === 'in_progress' && item.progressRatio != null && item.progressRatio > 0 ? item.progressRatio : null;

  return (
    <div className={cn('relative overflow-hidden', tint, className)}>
      <div className="absolute inset-0 flex flex-col justify-between p-3 md:p-6">
        <span className="self-end rounded-sm border border-border/30 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground shadow-sm">
          官方
        </span>
        <p className="font-heading line-clamp-4 text-sm font-bold leading-snug text-foreground/85 md:text-lg">
          {item.title}
        </p>
      </div>
      {progress != null ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
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
}: {
  status: DiscoverShelfStatus;
  progressRatio: number | null;
  readHref: string;
  onAdd: () => void;
  compact?: boolean;
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
      className={cn(
        'hover:bg-brand-deep active:scale-[0.98]',
        compact ? 'h-8 rounded-lg px-3 text-[13px]' : 'h-9 rounded-full px-4 text-sm shadow-sm',
      )}
      onClick={() => {
        onAdd();
        toast.success('已加入书架（原型预览）');
      }}
    >
      加入书架
    </Button>
  );
}

export function DiscoverBookCard({ item, shelfStatus, onAddToShelf }: DiscoverBookCardProps) {
  const levelLabel = LEVEL_LABEL[item.level] ?? item.level;
  const minutes = item.estimatedMinutes != null ? `约 ${item.estimatedMinutes} 分钟` : null;
  const detailHref = AUTH_ROUTES.bookDetail(item.id);
  const readHref = AUTH_ROUTES.readBook(item.id);

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
          shelfStatus={shelfStatus}
          className="aspect-[2/3] w-24 rounded-lg md:aspect-[3/4] md:w-full md:rounded-none"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 md:flex-grow md:bg-paper md:p-6">
        <Link href={detailHref} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="mb-1 block text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase md:mb-2 md:text-xs md:tracking-[0.12em]">
            <span className="md:hidden">{item.category}</span>
            <span className="hidden md:inline">{metaLine(item)}</span>
          </span>
          <h2 className="font-heading text-lg leading-tight font-semibold text-foreground transition-colors duration-200 ease-out-soft group-hover:text-primary md:text-2xl md:leading-8">
            {item.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground md:mt-1.5 md:italic">
            <span className="md:hidden">By {item.author}</span>
            <span className="hidden md:inline">by {item.author}</span>
          </p>
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground md:mt-4 md:line-clamp-3 md:text-base md:leading-6 md:text-foreground/90">
            {item.description}
          </p>
          <p className="mt-2 hidden text-xs text-muted-foreground md:mt-3 md:block">
            {[levelLabel, minutes].filter(Boolean).join(' · ')}
          </p>
        </Link>

        <div className="mt-3 flex items-center md:hidden">
          <ShelfAction
            status={shelfStatus}
            progressRatio={item.progressRatio}
            readHref={readHref}
            onAdd={() => onAddToShelf(item.id)}
            compact
          />
        </div>

        <div className="mt-auto hidden items-center justify-between border-t border-border/30 pt-4 md:flex">
          <Link
            href={detailHref}
            className="text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out-soft hover:text-primary"
          >
            查看详情
          </Link>
          <ShelfAction
            status={shelfStatus}
            progressRatio={item.progressRatio}
            readHref={readHref}
            onAdd={() => onAddToShelf(item.id)}
          />
        </div>
      </div>
    </article>
  );
}
