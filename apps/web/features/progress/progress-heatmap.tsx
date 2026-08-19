import {
  buildHeatmapWeeks,
  type CalendarDate,
  countLearningDaysInWindow,
  type HeatmapLevel,
  inclusiveDayCount,
  type ProgressWindow,
} from '@/features/progress/progress-model';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', ''] as const;

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: 'bg-muted',
  1: 'bg-primary/25',
};

type ProgressHeatmapProps = {
  today: CalendarDate;
  activity: ReadonlyMap<CalendarDate, HeatmapLevel>;
  selectedWindow: ProgressWindow;
};

function cellLabel(date: CalendarDate, level: HeatmapLevel, future: boolean): string {
  if (future) {
    return `${date}，尚未到来`;
  }
  if (level === 0) {
    return `${date}，没打开`;
  }
  return `${date}，有学习`;
}

function rangeCaption(window: ProgressWindow, today: CalendarDate, learningDays: number): string {
  const isSingle = window.from === window.to;
  if (isSingle && window.from === today) {
    return learningDays > 0 ? '今天打开过。' : '今天还没有打开。';
  }
  if (isSingle) {
    return learningDays > 0 ? '这一天打开过。' : '这一天没有打开。';
  }
  return `这 ${inclusiveDayCount(window)} 天里，有 ${learningDays} 天打开过。`;
}

/**
 * GitHub contribution graph: 53 Sunday-start weeks. Presence only (opened / not).
 */
export function ProgressHeatmap({ today, activity, selectedWindow }: ProgressHeatmapProps) {
  const weeks = buildHeatmapWeeks(today, activity, selectedWindow);
  const learningDays = countLearningDaysInWindow(activity, selectedWindow);
  const isSingleDay = selectedWindow.from === selectedWindow.to;

  return (
    <section>
      <p className="text-sm text-muted-foreground">{rangeCaption(selectedWindow, today, learningDays)}</p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4">
        <div className="inline-flex min-w-max gap-2">
          <div className="flex flex-col gap-[3px] pt-5 text-[10px] leading-[11px] text-muted-foreground" aria-hidden>
            {WEEKDAY_LABELS.map((label, row) => (
              <span key={`weekday-${row}`} className="h-[11px]">
                {label}
              </span>
            ))}
          </div>

          <div>
            <div className="mb-1 flex gap-[3px]">
              {weeks.map((week) => (
                <div key={`month-${week.sunday}`} className="h-4 w-[11px] shrink-0 overflow-visible">
                  {week.monthLabel ? (
                    <span className="block w-max text-[10px] leading-4 text-muted-foreground">{week.monthLabel}</span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex gap-[3px]" role="img" aria-label="近一年学习日">
              {weeks.map((week) => (
                <div key={week.sunday} className="flex flex-col gap-[3px]">
                  {week.days.map((day) => (
                    <span
                      key={day.date}
                      title={cellLabel(day.date, day.level, day.future)}
                      aria-label={cellLabel(day.date, day.level, day.future)}
                      className={cn(
                        'size-[11px] rounded-[2px]',
                        day.future ? 'bg-transparent' : LEVEL_CLASS[day.level],
                        !day.future && !day.isInRange && 'opacity-25',
                        isSingleDay && day.isInRange && !day.future && 'ring-1 ring-primary/50',
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          <span>无</span>
          <span className={cn('size-[11px] rounded-[2px]', LEVEL_CLASS[0])} aria-hidden />
          <span className={cn('size-[11px] rounded-[2px]', LEVEL_CLASS[1])} aria-hidden />
          <span>有</span>
        </p>
      </div>
    </section>
  );
}
