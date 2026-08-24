'use client';

import { BookOpenIcon } from 'lucide-react';
import Link from 'next/link';

import type { ShelfItem } from '@gloaming/shared/api/shelf';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { coverTintForVolume } from '@/features/content/content-model';
import { cn } from '@/lib/utils';

function metaLine(entry: ShelfItem): string {
  const parts: string[] = [];
  if (entry.work.tags[0]) {
    parts.push(entry.work.tags[0]);
  }
  return parts.join(' · ');
}

export function ShelfContinueHero({ entry }: { entry: ShelfItem }) {
  const ratio = entry.state.progressRatio;
  const tint = coverTintForVolume(entry.work.tags, entry.work.title);

  return (
    <section className="mb-10 w-full md:mb-14">
      <div className="mb-4 flex items-center border-b border-border/40 pb-4">
        <h3 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">继续阅读</h3>
      </div>
      <div
        className={cn(
          'group relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-paper p-6 md:flex-row md:items-center md:gap-10 md:p-8',
        )}
      >
        <div
          className={cn(
            'relative mx-auto aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-sm shadow-card ring-1 ring-foreground/5 md:mx-0 md:w-36',
            tint,
          )}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-3">
            <p className="font-heading line-clamp-3 text-xs font-bold leading-snug text-foreground/85">
              {entry.work.title}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center md:text-left">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {metaLine(entry) || '阅读中'}
          </p>
          <h2 className="font-heading mb-4 text-2xl leading-tight font-semibold text-foreground md:text-3xl">
            {entry.work.title}
          </h2>
          <div className="mx-auto mb-5 max-w-md md:mx-0">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span className="font-medium text-primary">已读 {ratio}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-soft"
                style={{ width: `${Math.min(100, ratio)}%` }}
              />
            </div>
          </div>
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-8 shadow-sm hover:bg-brand-deep active:scale-[0.98]"
            render={<Link href={AUTH_ROUTES.readBook(entry.work.id)} />}
          >
            <BookOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
            继续阅读
          </Button>
        </div>
      </div>
    </section>
  );
}
