'use client';

type HistoryTrendProps = {
  heights: number[];
};

export function HistoryTrend({ heights }: HistoryTrendProps) {
  if (heights.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto hidden w-full max-w-reading-column space-y-4 md:block">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-foreground">阅读趋势</h2>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          阅读时长 · 分钟
        </p>
      </div>
      <div className="flex flex-col gap-6 rounded-2xl bg-paper p-8">
        <div className="flex h-32 items-end justify-between gap-1 px-2">
          {heights.map((h, index) => (
            <div
              key={index}
              className="w-full rounded-t-sm bg-primary/40 transition-[height] duration-500 ease-out-soft"
              style={{ height: `${Math.max(4, Math.min(100, h))}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="flex justify-between px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span>Oct</span>
          <span>Nov</span>
          <span>Dec</span>
        </div>
      </div>
    </section>
  );
}
