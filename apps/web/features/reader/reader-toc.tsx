'use client';

import { CheckIcon, ChevronLeftIcon } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ReaderChapterMeta } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

function subscribeMd(onChange: () => void) {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function useIsDesktop() {
  return useSyncExternalStore(
    subscribeMd,
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true,
  );
}

type ReaderTocProps = {
  open: boolean;
  bookTitle: string;
  chapters: ReaderChapterMeta[];
  currentChapterId: string;
  onOpenChange: (open: boolean) => void;
  onSelectChapter: (chapterId: string) => void;
};

function TocList({
  chapters,
  currentChapterId,
  onSelectChapter,
}: {
  chapters: ReaderChapterMeta[];
  currentChapterId: string;
  onSelectChapter: (chapterId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1 py-2">
      {chapters.map((ch) => {
        const isActive = ch.id === currentChapterId;
        return (
          <li key={ch.id}>
            <button
              type="button"
              className={cn(
                'flex w-full items-start gap-3 rounded-r-full px-4 py-3 text-left transition-colors',
                isActive
                  ? 'border-l-4 border-primary bg-accent/80 text-foreground'
                  : 'border-l-4 border-transparent text-muted-foreground hover:bg-surface-container-low hover:text-foreground',
              )}
              onClick={() => onSelectChapter(ch.id)}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                {ch.status === 'read' && !isActive ? (
                  <CheckIcon className="size-3.5 text-primary/70" strokeWidth={2} />
                ) : (
                  <span className="text-xs tabular-nums">{ch.index}</span>
                )}
              </span>
              <span className={cn('font-heading text-sm leading-snug', isActive && 'font-semibold')}>{ch.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ReaderToc({
  open,
  bookTitle,
  chapters,
  currentChapterId,
  onOpenChange,
  onSelectChapter,
}: ReaderTocProps) {
  const isDesktop = useIsDesktop();
  const isSheetOpen = open && !isDesktop;

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-80 flex-col border-r border-border/50 bg-surface-container-low transition-transform duration-300 ease-out-soft md:flex',
          open ? 'translate-x-0' : 'pointer-events-none -translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">目录</p>
            <p className="truncate font-heading text-sm text-foreground">{bookTitle}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="关闭目录"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeftIcon className="size-5" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TocList chapters={chapters} currentChapterId={currentChapterId} onSelectChapter={onSelectChapter} />
        </div>
      </aside>

      <Sheet open={isSheetOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[60vh] rounded-t-3xl border-border/50 bg-card p-0" showCloseButton>
          <SheetHeader className="border-b border-border/40 px-5 pt-4 pb-3">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
            <SheetTitle>目录</SheetTitle>
            <SheetDescription className="truncate">{bookTitle}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-1 pb-8">
            <TocList
              chapters={chapters}
              currentChapterId={currentChapterId}
              onSelectChapter={(id) => {
                onSelectChapter(id);
                onOpenChange(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
