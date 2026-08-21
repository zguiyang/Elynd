'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { HistoryEmptyState } from '@/features/history/history-empty-state';
import { HistoryHeader } from '@/features/history/history-header';
import { HistoryHeatmap } from '@/features/history/history-heatmap';
import { HISTORY_MOCK_EMPTY, HISTORY_MOCK_POPULATED, type HistoryRangeId } from '@/features/history/history-mock';
import { HistoryRangeTabs } from '@/features/history/history-range-tabs';
import { HistorySummary } from '@/features/history/history-summary';
import { HistoryTimeline } from '@/features/history/history-timeline';
import { HistoryTrend } from '@/features/history/history-trend';
import { HistoryWorksList } from '@/features/history/history-works-list';
import { cn } from '@/lib/utils';

/**
 * Reading history UI prototype: local mock data only (no /api/progress).
 * Append `?empty=1` to preview the empty state.
 */
export function HistoryPage() {
  const searchParams = useSearchParams();
  const isEmptyPreview = searchParams.get('empty') === '1';
  const data = isEmptyPreview ? HISTORY_MOCK_EMPTY : HISTORY_MOCK_POPULATED;

  const [desktopRange, setDesktopRange] = useState<HistoryRangeId>('7d');
  const [mobileRange, setMobileRange] = useState<HistoryRangeId>('3m');

  const isEmpty = data.works.length === 0 && data.activity.length === 0;

  return (
    <div
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700',
        'mx-auto flex w-full max-w-5xl flex-col',
        isEmpty ? 'min-h-[70dvh] justify-center' : '',
      )}
    >
      {!isEmptyPreview ? (
        <p className="mb-4 text-center text-xs text-muted-foreground md:mb-6">
          界面预览（假数据）· 加 ?empty=1 看空历史
        </p>
      ) : null}

      {isEmpty ? (
        <>
          <HistoryHeader />
          <HistoryEmptyState />
        </>
      ) : (
        <div className="flex flex-col gap-10 md:gap-16">
          <HistoryHeader />
          <HistorySummary summary={data.summary} />
          <HistoryRangeTabs
            desktopRange={desktopRange}
            mobileRange={mobileRange}
            onDesktopChange={setDesktopRange}
            onMobileChange={setMobileRange}
          />
          <HistoryHeatmap activity={data.activity} readingDaysInWindow={data.readingDaysInWindow} />
          <HistoryTrend heights={data.trendHeights} />
          <HistoryTimeline events={data.events} />
          <HistoryWorksList works={data.works} />
        </div>
      )}
    </div>
  );
}
