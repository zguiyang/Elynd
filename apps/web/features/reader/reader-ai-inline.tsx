'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ReaderAiInlineProps = {
  open: boolean;
  quote: string;
  answer: string;
  streaming: boolean;
  top: number;
  left: number;
  onOpenDrawer: () => void;
  onClose: () => void;
};

export function ReaderAiInline({
  open,
  quote,
  answer,
  streaming,
  top,
  left,
  onOpenDrawer,
  onClose,
}: ReaderAiInlineProps) {
  if (!open) return null;

  return (
    <div
      data-reader-ui
      className={cn(
        'fixed z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-border/50 bg-card p-4 shadow-card',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300',
      )}
      style={{ top, left }}
      role="dialog"
      aria-label="AI 短答"
    >
      <p className="line-clamp-2 border-l-2 border-primary/40 pl-3 font-heading text-sm italic text-muted-foreground">
        “{quote}”
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {answer}
        {streaming ? <span className="ml-0.5 inline-block animate-pulse">▍</span> : null}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
          关闭
        </Button>
        <Button type="button" size="sm" className="h-8 rounded-lg text-xs hover:bg-brand-deep" onClick={onOpenDrawer}>
          在抽屉中继续
        </Button>
      </div>
    </div>
  );
}
