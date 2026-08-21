'use client';

import { Loader2Icon, PauseIcon, PlayIcon, Volume2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ReaderAudioStatus } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderTtsProps = {
  status: ReaderAudioStatus;
  label: string;
  /** Hide when mobile TOC sheet open. */
  hidden?: boolean;
  tocOpen: boolean;
  aiDrawerOpen: boolean;
  onToggle: () => void;
};

export function ReaderTts({ status, label, hidden, tocOpen, aiDrawerOpen, onToggle }: ReaderTtsProps) {
  if (hidden) return null;

  const isActive = status === 'playing' || status === 'paused' || status === 'loading';
  const shouldShowBar = isActive;

  return (
    <div
      data-reader-ui
      className={cn(
        'fixed z-40 transition-all duration-300 ease-out-soft',
        // Mobile FAB
        'bottom-6 right-6 md:bottom-8',
        // Desktop: shift when TOC open (avoid AI conflict zone)
        tocOpen ? 'md:left-[350px] md:right-auto' : 'md:left-1/2 md:-translate-x-1/2 md:right-auto',
        aiDrawerOpen && 'md:left-auto md:right-[26rem] md:translate-x-0',
        tocOpen && 'max-md:pointer-events-none max-md:opacity-0',
      )}
    >
      {shouldShowBar ? (
        <div className="flex items-center gap-3 rounded-full border border-border/50 bg-card px-3 py-2 shadow-card">
          <Button
            type="button"
            size="icon"
            className="size-10 shrink-0 rounded-full hover:bg-brand-deep"
            aria-label={status === 'playing' ? '暂停' : '播放'}
            disabled={status === 'loading'}
            onClick={onToggle}
          >
            {status === 'loading' ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : status === 'playing' ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4" />
            )}
          </Button>
          <p className="hidden max-w-[10rem] truncate text-xs text-muted-foreground sm:block">{label}</p>
        </div>
      ) : (
        <Button
          type="button"
          size="icon"
          className="size-12 rounded-full shadow-card hover:bg-brand-deep md:size-11"
          aria-label="朗读本章"
          onClick={onToggle}
        >
          <Volume2Icon className="size-5" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
