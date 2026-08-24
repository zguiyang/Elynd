'use client';

import Link from 'next/link';

import type { ShelfItem } from '@gloaming/shared/api/shelf';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/content/content-model';
import { cn } from '@/lib/utils';

function articleMetaLine(entry: ShelfItem): string {
  const parts = [LEVEL_LABEL[entry.article.level]];
  if (entry.article.estimatedMinutes != null) {
    parts.push(`约 ${entry.article.estimatedMinutes} 分钟`);
  }
  if (entry.article.themes[0]) {
    parts.push(entry.article.themes[0]);
  }
  return parts.join(' · ');
}

export function ShelfContinueHero({ entry }: { entry: ShelfItem }) {
  const ratio = entry.progress.progressRatio;
  const tint = coverTintForVolume(entry.article.themes, entry.article.title);

  return (
    <section className="w-full">
      <div
        className={cn(
          'flex flex-col items-center gap-8 rounded-[1.75rem] border border-border/40 bg-paper p-6 shadow-card',
          'md:flex-row md:items-center md:gap-12 md:rounded-[2rem] md:p-10',
          'transition-colors duration-300 ease-out-soft hover:border-border/70',
        )}
      >
        <div
          className={cn(
            'flex aspect-[2/3] w-40 shrink-0 flex-col justify-end overflow-hidden rounded-sm p-4 shadow-card ring-1 ring-foreground/5',
            'md:w-56',
            'transition-transform duration-300 ease-out-soft hover:scale-[1.02]',
            tint,
          )}
          aria-hidden
        >
          <p className="font-heading line-clamp-4 text-base font-bold leading-snug text-foreground/85 md:text-lg">
            {entry.article.title}
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col text-center md:text-left">
          <span className="mx-auto mb-5 inline-flex w-fit rounded-full border border-border/50 bg-background/60 px-4 py-1.5 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase md:mx-0">
            正在阅读
          </span>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight text-foreground md:text-[2.5rem] md:leading-[1.1]">
            {entry.article.title}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">{articleMetaLine(entry)}</p>

          <div className="mx-auto mt-8 w-full max-w-sm md:mx-0">
            <div className="mb-3 flex justify-between text-sm text-muted-foreground">
              <span>{ratio > 0 ? `已读 ${ratio}%` : '刚开始'}</span>
              <span className="font-medium tabular-nums">{ratio}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-soft"
                style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
              />
            </div>
          </div>

          <Button
            nativeButton={false}
            className={cn(
              'mt-8 h-12 w-full rounded-full px-10 text-base hover:bg-brand-deep active:scale-[0.98] md:w-fit',
            )}
            render={<Link href={AUTH_ROUTES.readBook(entry.article.id)} />}
          >
            继续阅读
            <span aria-hidden className="ml-1">
              →
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}
