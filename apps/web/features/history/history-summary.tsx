'use client';

import type { HistoryViewModel } from '@/features/history/history-model';

const SUMMARY_ITEMS: ReadonlyArray<{
  key: keyof HistoryViewModel['portrait'] | 'consecutive';
  label: string;
  mobileLabel: string;
  format: (s: HistoryViewModel['portrait']) => string;
}> = [
  { key: 'readingDays', label: '阅读日', mobileLabel: '阅读日', format: (s) => String(s.readingDays) },
  { key: 'consecutive', label: '连续阅读', mobileLabel: '连续阅读', format: (s) => `${s.consecutiveDays} 天` },
  { key: 'completedWorks', label: '读完作品', mobileLabel: '读完作品', format: (s) => String(s.completedWorks) },
  {
    key: 'lookedUpWords',
    label: '查词',
    mobileLabel: '查询生词',
    format: (s) => s.lookedUpWords.toLocaleString('zh-CN'),
  },
];

export function HistorySummary({ portrait }: { portrait: HistoryViewModel['portrait'] }) {
  return (
    <>
      <section className="hidden w-full items-center justify-center gap-10 border-b border-border/50 py-8 md:flex">
        {SUMMARY_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {item.label}
            </span>
            <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">
              {item.format(portrait)}
            </span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        {SUMMARY_ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card p-4 shadow-card"
          >
            <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {item.mobileLabel}
            </span>
            <span className="font-heading text-2xl font-semibold text-primary tabular-nums">
              {item.format(portrait)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
