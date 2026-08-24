'use client';

import type { HistoryViewModel } from '@/features/history/history-model';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function formatDate(date: string): Date {
  return parseDate(date);
}

/** Binary heatmap for the past 52 weeks ending at `today`. */
function buildGrid(today: string, activity: HistoryViewModel['activity']): boolean[] {
  const activeDates = new Set(activity.map((d) => d.date));
  const end = parseDate(today);
  const start = new Date(end.getTime() - (52 * 7 - 1) * 86_400_000);
  const cells: boolean[] = [];

  for (let i = 0; i < 52 * 7; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    cells.push(activeDates.has(`${y}-${m}-${day}`));
  }
  return cells;
}

function readingDaysInWindow(today: string, activity: HistoryViewModel['activity']): number {
  const activeDates = new Set(activity.map((d) => d.date));
  const end = parseDate(today);
  const start = new Date(end.getTime() - (52 * 7 - 1) * 86_400_000);
  let count = 0;
  for (let i = 0; i < 52 * 7; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    if (activeDates.has(`${y}-${m}-${day}`)) {
      count += 1;
    }
  }
  return count;
}

type HistoryHeatmapProps = {
  today: string;
  activity: HistoryViewModel['activity'];
};

export function HistoryHeatmap({ today, activity }: HistoryHeatmapProps) {
  const cells = buildGrid(today, activity);
  const daysInWindow = readingDaysInWindow(today, activity);
  const yearLabel = formatDate(today).getUTCFullYear();

  return (
    <section className="mx-auto w-full max-w-reading-column space-y-4 md:space-y-6">
      <div className="hidden md:block">
        <h2 className="font-heading text-2xl font-semibold text-foreground">阅读记录</h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold text-primary tabular-nums">{daysInWindow} 个阅读日</span>
          <span className="text-sm text-muted-foreground">近一年，你都回来读过真实的英文。</span>
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
              {daysInWindow} 个阅读日
            </p>
          </div>
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{yearLabel}</span>
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
          {cells.map((active, index) => (
            <div
              key={index}
              className={cn('size-2.5 rounded-sm md:size-2', active ? 'bg-primary' : 'bg-surface-container-highest')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
