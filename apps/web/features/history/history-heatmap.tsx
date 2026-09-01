'use client';

import 'react-activity-calendar/tooltips.css';

import { useLayoutEffect, useRef, useState } from 'react';
import { ActivityCalendar, type ThemeInput } from 'react-activity-calendar';

import {
  countHistoryActivityDays,
  fitHistoryCalendarBlockSize,
  formatEngagedMinutesLabel,
  formatHistoryCalendarDate,
  HISTORY_ACTIVITY_MAX_LEVEL,
  HISTORY_CALENDAR_BLOCK_MARGIN,
  HISTORY_CALENDAR_FONT_SIZE,
  HISTORY_CALENDAR_MIN_BLOCK_SIZE,
  HISTORY_MONTH_LABELS,
  HISTORY_WEEKDAY_LABELS,
  historyCalendarWeekColumns,
  historyCalendarWeekdayGutterPx,
  type HistoryViewModel,
  refineHistoryCalendarBlockSize,
  toHistoryActivityCalendarData,
} from '@/features/history/history-model';

const HISTORY_CALENDAR_THEME: ThemeInput = {
  light: [
    'color-mix(in oklab, var(--on-surface) 12%, white)',
    'color-mix(in oklab, var(--primary) 35%, white)',
    'color-mix(in oklab, var(--primary) 55%, white)',
    'color-mix(in oklab, var(--primary) 75%, white)',
    'var(--primary)',
  ],
};

const LIBRARY_SCROLL_SELECTOR = '.react-activity-calendar-scroll-container';

type HistoryHeatmapProps = {
  today: string;
  activity: HistoryViewModel['activity'];
};

function scrollLibraryCalendarToLatest(root: HTMLElement): void {
  const scroller = root.querySelector(LIBRARY_SCROLL_SELECTOR);
  if (!(scroller instanceof HTMLElement)) {
    return;
  }
  if (scroller.scrollWidth <= scroller.clientWidth + 1) {
    return;
  }
  scroller.scrollLeft = scroller.scrollWidth - scroller.clientWidth;
}

export function HistoryHeatmap({ today, activity }: HistoryHeatmapProps) {
  const data = toHistoryActivityCalendarData(today, activity);
  const daysInWindow = countHistoryActivityDays(activity, today);
  const frameRef = useRef<HTMLDivElement>(null);
  const [blockSize, setBlockSize] = useState<number>(HISTORY_CALENDAR_MIN_BLOCK_SIZE);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') {
      return;
    }

    const syncFromWidth = () => {
      const available = frame.clientWidth;
      if (available <= 0) {
        return;
      }
      const next = fitHistoryCalendarBlockSize(
        available,
        historyCalendarWeekColumns(today),
        historyCalendarWeekdayGutterPx(HISTORY_CALENDAR_FONT_SIZE),
      );
      setBlockSize((current) => (current === next ? current : next));
    };

    syncFromWidth();
    const observer = new ResizeObserver(syncFromWidth);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [today, activity]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const scroller = frame.querySelector(LIBRARY_SCROLL_SELECTOR);
    if (!(scroller instanceof HTMLElement) || scroller.scrollWidth <= 0) {
      return;
    }

    if (scroller.scrollWidth > scroller.clientWidth + 1) {
      const shrunk = refineHistoryCalendarBlockSize(scroller.clientWidth, scroller.scrollWidth, blockSize);
      if (shrunk !== blockSize) {
        setBlockSize(shrunk);
        return;
      }
      scrollLibraryCalendarToLatest(frame);
      return;
    }

    scrollLibraryCalendarToLatest(frame);
  }, [blockSize, today, activity]);

  return (
    <section className="w-full space-y-4 md:space-y-6">
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

      <div className="rounded-2xl border border-border/50 bg-card p-4 md:p-6">
        <div className="mb-4 md:hidden">
          <p className="text-sm text-foreground">阅读分布</p>
          <p className="text-[11px] font-medium text-muted-foreground">近一年 · {daysInWindow} 个阅读日</p>
        </div>

        {/* Library owns overflowX; we size blockSize so mid/large screens fit without scroll. */}
        <div ref={frameRef} className="w-full">
          <ActivityCalendar
            data={data}
            colorScheme="light"
            theme={HISTORY_CALENDAR_THEME}
            maxLevel={HISTORY_ACTIVITY_MAX_LEVEL}
            blockSize={blockSize}
            blockMargin={HISTORY_CALENDAR_BLOCK_MARGIN}
            blockRadius={2}
            fontSize={HISTORY_CALENDAR_FONT_SIZE}
            weekStart={0}
            showMonthLabels
            showColorLegend
            showTotalCount={false}
            showWeekdayLabels={['mon', 'wed', 'fri']}
            labels={{
              months: [...HISTORY_MONTH_LABELS],
              weekdays: [...HISTORY_WEEKDAY_LABELS],
              legend: { less: '少', more: '多' },
            }}
            tooltips={{
              activity: {
                text: (day) =>
                  day.level > 0
                    ? `${formatHistoryCalendarDate(day.date)} · ${formatEngagedMinutesLabel(day.count)}`
                    : `${formatHistoryCalendarDate(day.date)} · 未阅读`,
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}
