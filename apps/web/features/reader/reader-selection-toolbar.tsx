'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ReaderSelectionToolbarProps = {
  visible: boolean;
  top: number;
  left: number;
  onExplain: () => void;
  onAskAi: () => void;
  onLookup: () => void;
  onTranslate: () => void;
};

export function ReaderSelectionToolbar({
  visible,
  top,
  left,
  onExplain,
  onAskAi,
  onLookup,
  onTranslate,
}: ReaderSelectionToolbarProps) {
  if (!visible) return null;

  return (
    <div
      data-reader-ui
      className={cn(
        'fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-border/60 bg-card px-1 py-1 shadow-card',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200',
      )}
      style={{ top, left }}
      role="toolbar"
      aria-label="划词工具"
    >
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={onExplain}>
        解释
      </Button>
      <Button type="button" size="sm" className="h-8 rounded-lg px-2.5 text-xs hover:bg-brand-deep" onClick={onAskAi}>
        问 AI
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={onLookup}>
        查词
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={onTranslate}>
        翻译
      </Button>
    </div>
  );
}
