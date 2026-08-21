'use client';

import { HISTORY_DESKTOP_RANGES, HISTORY_MOBILE_RANGES, type HistoryRangeId } from '@/features/history/history-mock';
import { cn } from '@/lib/utils';

type HistoryRangeTabsProps = {
  desktopRange: HistoryRangeId;
  mobileRange: HistoryRangeId;
  onDesktopChange: (id: HistoryRangeId) => void;
  onMobileChange: (id: HistoryRangeId) => void;
};

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ease-out-soft',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active
          ? 'bg-primary font-medium text-primary-foreground'
          : 'bg-surface-container-high text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

export function HistoryRangeTabs({
  desktopRange,
  mobileRange,
  onDesktopChange,
  onMobileChange,
}: HistoryRangeTabsProps) {
  return (
    <>
      <div className="mx-auto mt-6 hidden w-full max-w-reading-column justify-end md:flex">
        <div className="flex gap-1 rounded-full bg-surface-container-low p-1">
          {HISTORY_DESKTOP_RANGES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              active={desktopRange === item.id}
              onClick={() => onDesktopChange(item.id)}
            />
          ))}
        </div>
      </div>

      <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HISTORY_MOBILE_RANGES.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            active={mobileRange === item.id}
            onClick={() => onMobileChange(item.id)}
          />
        ))}
      </div>
    </>
  );
}
