'use client';

import type { HistorySummary } from '@/features/history/history-mock';
import { cn } from '@/lib/utils';

const SUMMARY_ITEMS: ReadonlyArray<{
  key: string;
  label: string;
  mobileLabel: string;
  format: (s: HistorySummary) => string;
}> = [
  { key: 'readingDays', label: '阅读日', mobileLabel: '阅读日', format: (s) => String(s.readingDays) },
  { key: 'duration', label: '阅读时长', mobileLabel: '阅读时长', format: (s) => s.durationLabel },
  { key: 'texts', label: '读过文本', mobileLabel: '读完作品', format: (s) => String(s.textsRead) },
  {
    key: 'lookups',
    label: '查词',
    mobileLabel: '查询生词',
    format: (s) => s.lookups.toLocaleString('zh-CN'),
  },
];

export function HistorySummary({ summary }: { summary: HistorySummary }) {
  return (
    <>
      {/* Desktop: quiet inline strip */}
      <section
        className={cn(
          'mx-auto hidden w-full max-w-reading-column items-center justify-center gap-10 border-b border-border/50 py-8 md:flex',
        )}
      >
        {SUMMARY_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {item.label}
            </span>
            <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">
              {item.format(summary)}
            </span>
          </div>
        ))}
      </section>

      {/* Mobile: 2×2 paper cards */}
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
              {item.format(summary)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
