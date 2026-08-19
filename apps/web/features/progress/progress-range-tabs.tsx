'use client';

import { useState } from 'react';
import { type DateRange } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type CalendarDate,
  calendarDateToLocalDate,
  clampWindow,
  formatRangeCaption,
  localDateToCalendarDate,
  type ProgressRangeTab,
  type ProgressWindow,
} from '@/features/progress/progress-model';
import { cn } from '@/lib/utils';

const PRESET_TABS: { value: Exclude<ProgressRangeTab, 'custom'>; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: '7', label: '近7天' },
  { value: '30', label: '近30天' },
];

const tabTriggerClass = cn(
  'h-auto flex-none rounded-none px-0 py-1 shadow-none after:bg-primary',
  'text-muted-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none',
);

type ProgressRangeTabsProps = {
  tab: ProgressRangeTab;
  today: CalendarDate;
  custom: ProgressWindow;
  onTabChange: (tab: ProgressRangeTab) => void;
  onCustomChange: (window: ProgressWindow) => void;
};

/**
 * Quiet date lens under the progress headline. Custom opens a range calendar.
 */
export function ProgressRangeTabs({ tab, today, custom, onTabChange, onCustomChange }: ProgressRangeTabsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const selected: DateRange = draft ?? {
    from: calendarDateToLocalDate(custom.from),
    to: calendarDateToLocalDate(custom.to),
  };

  function applyRange(range: DateRange | undefined) {
    setDraft(range);
    if (!range?.from || !range.to) {
      return;
    }
    const next = clampWindow({
      from: localDateToCalendarDate(range.from),
      to: localDateToCalendarDate(range.to),
    });
    onCustomChange(next);
    onTabChange('custom');
    setDraft(undefined);
    setIsOpen(false);
  }

  return (
    <div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === 'today' || value === 'yesterday' || value === '7' || value === '30') {
            onTabChange(value);
          }
        }}
      >
        <TabsList
          variant="line"
          aria-label="时间范围"
          className="h-auto w-full flex-wrap justify-start gap-x-5 gap-y-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {PRESET_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className={tabTriggerClass}>
              {item.label}
            </TabsTrigger>
          ))}
          <Popover
            open={isOpen}
            onOpenChange={(next) => {
              setIsOpen(next);
              if (next) {
                onTabChange('custom');
                setDraft(undefined);
              }
            }}
          >
            <PopoverTrigger
              className={cn(
                tabTriggerClass,
                'relative inline-flex items-center text-sm font-medium',
                tab === 'custom' ? 'text-foreground after:opacity-100' : 'text-muted-foreground after:opacity-0',
                'after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-primary after:transition-opacity',
              )}
            >
              自选
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                locale={zhCN}
                defaultMonth={selected.from}
                selected={selected}
                disabled={{ after: calendarDateToLocalDate(today) }}
                onSelect={applyRange}
              />
            </PopoverContent>
          </Popover>
        </TabsList>
      </Tabs>
      {tab === 'custom' ? <p className="mt-3 text-xs text-muted-foreground">{formatRangeCaption(custom)}</p> : null}
    </div>
  );
}
