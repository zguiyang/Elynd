'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DISCOVER_CATEGORIES,
  DISCOVER_SORT_OPTIONS,
  DISCOVER_TAGS,
  type DiscoverCategory,
  type DiscoverSortValue,
  type DiscoverTag,
} from '@/features/discover/discover-mock';
import { cn } from '@/lib/utils';

type DiscoverFiltersProps = {
  category: DiscoverCategory;
  tag: DiscoverTag;
  sort: DiscoverSortValue;
  onCategoryChange: (value: DiscoverCategory) => void;
  onTagChange: (value: DiscoverTag) => void;
  onSortChange: (value: DiscoverSortValue) => void;
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

function SortControl({
  sort,
  onSortChange,
}: {
  sort: DiscoverSortValue;
  onSortChange: (v: DiscoverSortValue) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>排序</span>
      <Select
        items={DISCOVER_SORT_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
        value={sort}
        onValueChange={(value) => {
          if (value == null) {
            return;
          }
          onSortChange(value as DiscoverSortValue);
        }}
      >
        <SelectTrigger
          aria-label="排序方式"
          className="h-9 w-[8.5rem] rounded-xl border-border bg-card shadow-none hover:text-foreground"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          <SelectGroup>
            {DISCOVER_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function MobileTuneSheet({ category, tag, sort, onCategoryChange, onTagChange, onSortChange }: DiscoverFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

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
          <SheetTitle>筛选与排序</SheetTitle>
          <SheetDescription className="sr-only">选择标签与排序方式</SheetDescription>
        </SheetHeader>
        <div className="flex max-h-[70dvh] flex-col gap-6 overflow-y-auto px-5 py-6">
          <div>
            <p className="mb-3 text-sm text-muted-foreground">标签</p>
            <div className="flex flex-wrap gap-2">
              {DISCOVER_TAGS.map((item) => (
                <Chip key={item} label={item} active={tag === item} onClick={() => onTagChange(item)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">排序</p>
            <div className="flex flex-wrap gap-2">
              {DISCOVER_SORT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={sort === option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">分类</p>
            <div className="flex flex-wrap gap-2">
              {DISCOVER_CATEGORIES.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  active={category === item}
                  onClick={() => {
                    onCategoryChange(item);
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

export function DiscoverFilters({
  category,
  tag,
  sort,
  onCategoryChange,
  onTagChange,
  onSortChange,
}: DiscoverFiltersProps) {
  return (
    <div className="mb-8 border-b border-border/40 pb-5 md:mb-10 md:pb-6">
      <div className="sticky top-0 z-20 -mx-1 flex items-center gap-2 bg-background/95 py-2 backdrop-blur-sm md:static md:mx-0 md:hidden md:bg-transparent md:py-0 md:backdrop-blur-none">
        <div className="flex flex-1 gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DISCOVER_CATEGORIES.map((item) => (
            <Chip key={item} label={item} active={category === item} onClick={() => onCategoryChange(item)} />
          ))}
        </div>
        <MobileTuneSheet
          category={category}
          tag={tag}
          sort={sort}
          onCategoryChange={onCategoryChange}
          onTagChange={onTagChange}
          onSortChange={onSortChange}
        />
      </div>

      <div className="hidden flex-col gap-6 md:flex lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-1 text-sm text-muted-foreground">分类:</span>
            {DISCOVER_CATEGORIES.map((item) => (
              <Chip key={item} label={item} active={category === item} onClick={() => onCategoryChange(item)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-1 text-sm text-muted-foreground">标签:</span>
            {DISCOVER_TAGS.map((item) => (
              <Chip key={item} label={item} active={tag === item} onClick={() => onTagChange(item)} />
            ))}
          </div>
        </div>
        <SortControl sort={sort} onSortChange={onSortChange} />
      </div>
    </div>
  );
}
