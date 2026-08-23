'use client';

import Link from 'next/link';

import type { LearnTodayEntry } from '@gloaming/shared/api/learn';

import { AUTH_ROUTES } from '@/constants';
import { coverTintForVolume, LEVEL_LABEL } from '@/features/content/content-model';
import { cn } from '@/lib/utils';

function statusLabel(entry: LearnTodayEntry): string {
  if (entry.progress.status === 'completed') {
    return '已读完';
  }
  if (entry.progress.progressRatio <= 0) {
    return '未开始';
  }
  return `已读 ${entry.progress.progressRatio}%`;
}

export function ShelfBookCard({ entry }: { entry: LearnTodayEntry }) {
  const { article, progress } = entry;
  const tint = coverTintForVolume(article.themes, article.title);
  const levelLabel = LEVEL_LABEL[article.level] ?? article.level;
  const minutes = article.estimatedMinutes != null ? `约 ${article.estimatedMinutes} 分钟` : null;
  const themes = article.themes.slice(0, 2).join(' · ');
  const hasProgressBar = progress.status === 'in_progress' && progress.progressRatio > 0;

  return (
    <Link
      href={AUTH_ROUTES.readBook(article.id)}
      className={cn(
        'group flex flex-col gap-3 outline-none',
        'transition-transform duration-300 ease-out-soft',
        'hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50',
      )}
    >
      <div
        className={cn(
          'relative aspect-[2/3] overflow-hidden rounded-sm shadow-card ring-1 ring-foreground/5',
          'transition-[box-shadow,transform] duration-300 ease-out-soft',
          tint,
        )}
      >
        <div className="absolute inset-0 flex flex-col justify-between p-3 md:p-4">
          <div className="flex justify-end">
            <span className="rounded-sm border border-border/30 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground shadow-sm">
              官方
            </span>
          </div>
          <p className="font-heading line-clamp-4 text-sm font-bold leading-snug text-foreground/85 md:text-base">
            {article.title}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <h3
          className="font-heading line-clamp-2 text-sm leading-snug font-medium text-foreground transition-colors duration-300 ease-out-soft group-hover:text-primary md:text-base"
          title={article.title}
        >
          {article.title}
        </h3>
        <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
          {[levelLabel, minutes, themes].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/90">{statusLabel(entry)}</p>
        {hasProgressBar ? (
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-soft"
              style={{ width: `${Math.min(100, progress.progressRatio)}%` }}
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
