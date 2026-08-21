'use client';

import type { HistoryActivityDay, HistoryActivityLevel } from '@/features/history/history-mock';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const LEVEL_CLASS: Record<HistoryActivityLevel, string> = {
  0: 'bg-surface-container-highest',
  1: 'bg-primary/20',
  2: 'bg-primary/50',
  3: 'bg-primary',
};

/** Prototype heatmap: fixed 52 weeks × 7 rows from mock activity map. */
function buildGrid(activity: HistoryActivityDay[]): HistoryActivityLevel[] {
  const map = new Map(activity.map((d) => [d.date, d.level]));
  const cells: HistoryActivityLevel[] = [];
  const start = new Date(Date.UTC(2025, 0, 5)); // Sunday-ish anchor for mock year
  for (let i = 0; i < 52 * 7; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    cells.push(map.get(`${y}-${m}-${day}`) ?? 0);
  }
  return cells;
}

type HistoryHeatmapProps = {
  activity: HistoryActivityDay[];
  readingDaysInWindow: number;
};

export function HistoryHeatmap({ activity, readingDaysInWindow }: HistoryHeatmapProps) {
  const cells = buildGrid(activity);

  return (
    <section className="mx-auto w-full max-w-reading-column space-y-4 md:space-y-6">
      <div className="hidden md:block">
        <h2 className="font-heading text-2xl font-semibold text-foreground">阅读记录</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold text-primary tabular-nums">
            {readingDaysInWindow} 个阅读日
          </span>
          <span className="text-sm text-muted-foreground">这 {readingDaysInWindow} 天，你都回来读过真实的英文。</span>
        </p>
      </div>

      <div className="md:hidden">
        <h2 className="border-b border-border/50 pb-2 text-sm font-medium tracking-wider text-muted-foreground uppercase">
          阅读记录
        </h2>
      </div>

      <div className="rounded-2xl bg-paper p-4 md:p-8">
        <div className="mb-3 flex items-end justify-between md:hidden">
          <div>
            <p className="text-sm text-foreground">阅读分布</p>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {readingDaysInWindow} 个阅读日
            </p>
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">2025</span>
        </div>

        <div className="mb-2 hidden justify-between px-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase md:flex">
          {MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>

        <div
          className="grid h-28 grid-flow-col grid-rows-7 gap-1 overflow-x-auto md:h-32"
          role="img"
          aria-label="阅读日分布"
        >
          {cells.map((level, index) => (
            <div key={index} className={cn('size-2.5 rounded-sm md:size-2', LEVEL_CLASS[level])} />
          ))}
        </div>

        <div className="mt-3 hidden items-center justify-end gap-2 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase md:flex">
          <span>Less</span>
          <span className={cn('size-2 rounded-sm', LEVEL_CLASS[0])} aria-hidden />
          <span className={cn('size-2 rounded-sm', LEVEL_CLASS[1])} aria-hidden />
          <span className={cn('size-2 rounded-sm', LEVEL_CLASS[2])} aria-hidden />
          <span className={cn('size-2 rounded-sm', LEVEL_CLASS[3])} aria-hidden />
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
