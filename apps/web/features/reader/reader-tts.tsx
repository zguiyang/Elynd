'use client';

import { Loader2Icon, PauseIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ReaderAudioStatus } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderTtsProps = {
  status: ReaderAudioStatus;
  label: string;
  tocOpen: boolean;
  aiDrawerOpen: boolean;
  onToggle: () => void;
};

/** Mini player only — idle entry lives in reader chrome (headphones). */
export function ReaderTts({ status, label, tocOpen, aiDrawerOpen, onToggle }: ReaderTtsProps) {
  const isActive = status === 'playing' || status === 'paused' || status === 'loading';
  if (!isActive) return null;

  return (
    <div
      data-reader-ui
      className={cn(
        'fixed z-40 transition-all duration-300 ease-out-soft',
        // Mobile: bottom-right
        'bottom-6 right-6',
        // Desktop: bottom-left; shift when TOC open
        'md:bottom-8 md:right-auto',
        tocOpen ? 'md:left-[350px]' : 'md:left-8',
        aiDrawerOpen && 'max-md:right-6',
        tocOpen && 'max-md:pointer-events-none max-md:opacity-0',
      )}
    >
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
    </div>
  );
}
