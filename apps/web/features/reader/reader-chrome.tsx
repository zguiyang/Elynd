'use client';

import { ArrowLeftIcon, HeadphonesIcon, ListIcon, SparklesIcon, TypeIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import type { ReaderFontSize } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderChromeProps = {
  visible: boolean;
  bookTitle: string;
  chapterIndex: number;
  chapterCount: number;
  progressRatio: number;
  fontSize: ReaderFontSize;
  tocOpen: boolean;
  aiOpen: boolean;
  /** Listening session active (playing / paused / loading). */
  isListening: boolean;
  onToggleFontSize: () => void;
  onToggleToc: () => void;
  onToggleAi: () => void;
  onToggleTts: () => void;
};

export function ReaderChrome({
  visible,
  bookTitle,
  chapterIndex,
  chapterCount,
  progressRatio,
  fontSize,
  tocOpen,
  aiOpen,
  isListening,
  onToggleFontSize,
  onToggleToc,
  onToggleAi,
  onToggleTts,
}: ReaderChromeProps) {
  const fill = Math.min(100, Math.max(0, Math.round(progressRatio * 100)));

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md transition-all duration-300 ease-out-soft',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              nativeButton={false}
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 text-muted-foreground hover:text-foreground"
              render={<Link href={AUTH_ROUTES.shelf} aria-label="返回书架" />}
            >
              <ArrowLeftIcon className="size-5" strokeWidth={1.5} />
            </Button>
            <p className="hidden min-w-0 truncate font-heading text-sm text-foreground md:block md:text-base">
              {bookTitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-foreground"
              aria-label={`字号：${fontSize}`}
              onClick={onToggleFontSize}
            >
              <TypeIcon className="size-5" strokeWidth={1.5} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-10 text-muted-foreground hover:text-foreground',
                tocOpen && 'bg-accent text-brand-deep',
              )}
              aria-label="目录"
              aria-pressed={tocOpen}
              onClick={onToggleToc}
            >
              <ListIcon className="size-5" strokeWidth={1.5} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-10 text-muted-foreground hover:text-foreground',
                aiOpen && 'bg-accent text-brand-deep',
              )}
              aria-label="AI 辅助"
              aria-pressed={aiOpen}
              onClick={onToggleAi}
            >
              <SparklesIcon className="size-5" strokeWidth={1.5} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-10 text-muted-foreground hover:text-foreground',
                isListening && 'bg-accent text-brand-deep',
              )}
              aria-label="听读"
              aria-pressed={isListening}
              onClick={onToggleTts}
            >
              <HeadphonesIcon className="size-5" strokeWidth={1.5} />
            </Button>
          </div>
        </div>

        <div className="h-1 w-full bg-surface-container-highest/80" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out-soft"
            style={{ width: `${fill}%` }}
          />
        </div>
      </header>

      <p
        className={cn(
          'pointer-events-none fixed inset-x-0 top-16 z-30 text-center text-[10px] tracking-wide text-muted-foreground transition-opacity duration-300 md:top-[4.25rem]',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      >
        {chapterIndex} / {chapterCount}
      </p>
    </>
  );
}
