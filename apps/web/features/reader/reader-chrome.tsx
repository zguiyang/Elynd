'use client';

import { ArrowLeftIcon, HeadphonesIcon, SparklesIcon, TypeIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import type { ReaderFontSize } from '@/features/reader/reader-model';
import { cn } from '@/lib/utils';

type ReaderChromeProps = {
  visible: boolean;
  title: string;
  progressRatio: number;
  fontSize: ReaderFontSize;
  aiOpen: boolean;
  isListening: boolean;
  onToggleFontSize: () => void;
  onToggleAi: () => void;
  onToggleTts: () => void;
};

function navigateReaderBack(router: ReturnType<typeof useRouter>) {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.replace(AUTH_ROUTES.shelf);
}

export function ReaderChrome({
  visible,
  title,
  progressRatio,
  fontSize,
  aiOpen,
  isListening,
  onToggleFontSize,
  onToggleAi,
  onToggleTts,
}: ReaderChromeProps) {
  const router = useRouter();
  const fill = Math.min(100, Math.max(0, Math.round(progressRatio)));

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-md transition-all duration-300 ease-out-soft',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
      )}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="返回"
            onClick={() => navigateReaderBack(router)}
          >
            <ArrowLeftIcon className="size-5" strokeWidth={1.5} />
          </Button>
          <p className="hidden min-w-0 truncate font-heading text-sm text-foreground md:block md:text-base">{title}</p>
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
            className={cn('size-10 text-muted-foreground hover:text-foreground', aiOpen && 'bg-accent text-brand-deep')}
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
  );
}
