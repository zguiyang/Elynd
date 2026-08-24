'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DISCOVER_ALL_THEME, type DiscoverThemeFilter } from '@/features/discover/discover-model';
import { cn } from '@/lib/utils';

type DiscoverFiltersProps = {
  theme: DiscoverThemeFilter;
  themes: string[];
  onThemeChange: (value: DiscoverThemeFilter) => void;
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
          : 'border border-border bg-transparent text-muted-foreground hover:bg-surface-container-high md:border-0 md:bg-surface-container',
      )}
    >
      {label}
    </button>
  );
}

function themeOptions(catalogThemes: string[]): DiscoverThemeFilter[] {
  return [DISCOVER_ALL_THEME, ...catalogThemes];
}

function MobileTuneSheet({ theme, themes, onThemeChange }: DiscoverFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const options = themeOptions(themes);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-8 shrink-0 rounded-full bg-surface-container-high text-muted-foreground shadow-none md:hidden"
            aria-label="更多筛选"
          />
        }
      >
        <SlidersHorizontalIcon className="size-4" strokeWidth={1.5} aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 rounded-t-2xl">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle>筛选</SheetTitle>
          <SheetDescription className="sr-only">选择主题标签</SheetDescription>
        </SheetHeader>
        <div className="flex max-h-[70dvh] flex-col gap-6 overflow-y-auto px-5 py-6">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">主题</p>
            <div className="flex flex-wrap gap-2">
              {options.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={theme === item}
                  onClick={() => {
                    onThemeChange(item);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DiscoverFilters({ theme, themes, onThemeChange }: DiscoverFiltersProps) {
  const options = themeOptions(themes);

  return (
    <div className="mb-8 border-b border-border/40 pb-5 md:mb-10 md:pb-6">
      <div className="sticky top-0 z-20 -mx-1 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm md:static md:mx-0 md:hidden md:bg-transparent md:py-0 md:backdrop-blur-none">
        <div className="flex flex-1 gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((item) => (
            <Chip key={item} label={item} active={theme === item} onClick={() => onThemeChange(item)} />
          ))}
        </div>
        <MobileTuneSheet theme={theme} themes={themes} onThemeChange={onThemeChange} />
      </div>

      <div className="hidden flex-col gap-4 md:flex md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="mr-1 text-sm text-muted-foreground">主题:</span>
          {options.map((item) => (
            <Chip key={item} label={item} active={theme === item} onClick={() => onThemeChange(item)} />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">排序：最新发布</p>
      </div>
    </div>
  );
}
