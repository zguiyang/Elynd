'use client';

import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { formatHistoryApiError, useReadingHistoryQuery } from '@/features/history/history-api';
import { HistoryCompletions } from '@/features/history/history-completions';
import { HistoryEmptyState } from '@/features/history/history-empty-state';
import { HistoryHeader } from '@/features/history/history-header';
import { HistoryHeatmap } from '@/features/history/history-heatmap';
import { HistorySummary } from '@/features/history/history-summary';
import { cn } from '@/lib/utils';

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden>
      <div className="h-24 animate-pulse rounded-xl bg-surface-container-high" />
      <div className="h-48 animate-pulse rounded-2xl bg-surface-container-high" />
    </div>
  );
}

export function HistoryPage() {
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get('empty') === '1';
  const historyQuery = useReadingHistoryQuery({ enabled: !isEmptyPreview });

  if (isEmptyPreview) {
    return (
      <div
        className={cn(
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
          'mx-auto flex w-full max-w-5xl min-h-[70dvh] flex-col justify-center',
        )}
      >
        <HistoryHeader />
        <HistoryEmptyState />
      </div>
    );
  }

  if (historyQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <HistoryHeader />
        <HistorySkeleton />
      </div>
    );
  }

  if (historyQuery.isError) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center py-16 text-center">
        <HistoryHeader />
        <h2 className="font-heading text-2xl font-semibold">无法加载阅读历史</h2>
        <p className="mt-4 text-muted-foreground">{formatHistoryApiError(historyQuery.error)}</p>
        <Button className="mt-8 rounded-full px-10" onClick={() => void historyQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const data = historyQuery.data;
  const isEmpty = data.portrait.readingDays === 0 && data.completions.length === 0;

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col',
        isEmpty ? 'min-h-[70dvh] justify-center' : '',
      )}
    >
      {isEmpty ? (
        <>
          <HistoryHeader />
          <HistoryEmptyState />
        </>
      ) : (
        <div className="flex flex-col gap-10 md:gap-16">
          <HistoryHeader />
          <HistorySummary portrait={data.portrait} />
          <HistoryHeatmap today={data.today} activity={data.activity} />
          <HistoryCompletions completions={data.completions} />
        </div>
      )}
    </div>
  );
}
