'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ReaderAiInlineProps = {
  open: boolean;
  quote: string;
  answer: string;
  streaming: boolean;
  mode?: 'answer' | 'question';
  canOpenDrawer?: boolean;
  error?: string | null;
  top: number;
  left: number;
  onSubmitQuestion?: (question: string) => void;
  onOpenDrawer: () => void;
  onClose: () => void;
};

export function ReaderAiInline({
  open,
  quote,
  answer,
  streaming,
  mode = 'answer',
  canOpenDrawer = true,
  error,
  top,
  left,
  onSubmitQuestion,
  onOpenDrawer,
  onClose,
}: ReaderAiInlineProps) {
  const [draft, setDraft] = useState('');

  if (!open) return null;

  function submitQuestion() {
    const question = draft.trim();
    if (!question || streaming) return;
    onSubmitQuestion?.(question);
    setDraft('');
  }

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
      {mode === 'question' ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question about this selection..."
            className="h-10 rounded-xl border-border/60 bg-background"
            disabled={streaming}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" size="sm" className="h-8 rounded-lg text-xs hover:bg-brand-deep" disabled={streaming}>
              发送
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-3 min-h-5 text-sm leading-relaxed text-foreground">
            {answer}
            {streaming ? <span className="ml-0.5 inline-block animate-pulse">▍</span> : null}
          </p>
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
              关闭
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-lg text-xs hover:bg-brand-deep"
              onClick={onOpenDrawer}
              disabled={streaming || !canOpenDrawer}
            >
              继续追问
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
