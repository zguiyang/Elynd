'use client';

import { useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ReaderAiMessage } from '@/features/reader/reader-model';
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

type ReaderAiDrawerProps = {
  open: boolean;
  quote: string | null;
  messages: ReaderAiMessage[];
  suggestions: string[];
  onOpenChange: (open: boolean) => void;
  onSend: (text: string) => void;
};

function AiThread({
  quote,
  messages,
  suggestions,
  onSend,
}: {
  quote: string | null;
  messages: ReaderAiMessage[];
  suggestions: string[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {quote ? (
        <div className="border-b border-border/40 bg-surface-container-low/80 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Selected</p>
          <p className="mt-1 line-clamp-3 font-heading text-sm italic text-foreground/80">“{quote}”</p>
        </div>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">问一句关于这段文字的问题。AI 会基于当前章节回答。</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'mr-auto bg-surface-container-low text-foreground',
              )}
            >
              {m.content}
            </div>
          ))
        )}
        {messages.length === 0 && suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                onClick={() => submit(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form
        className="flex gap-2 border-t border-border/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about the text..."
          className="h-10 rounded-xl border-border/60 bg-background"
        />
        <Button type="submit" className="h-10 shrink-0 rounded-xl px-4 hover:bg-brand-deep">
          发送
        </Button>
      </form>
    </div>
  );
}

export function ReaderAiDrawer({ open, quote, messages, suggestions, onOpenChange, onSend }: ReaderAiDrawerProps) {
  const isDesktop = useIsDesktop();
  const isSheetOpen = open && !isDesktop;

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 hidden w-96 flex-col border-l border-border/50 bg-card transition-transform duration-300 ease-out-soft md:flex',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
          <div>
            <p className="font-heading text-base font-semibold text-foreground">AI Companion</p>
            <p className="text-xs text-muted-foreground">Ask about the text</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
        <AiThread quote={quote} messages={messages} suggestions={suggestions} onSend={onSend} />
      </aside>

      <Sheet open={isSheetOpen} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[70vh] max-h-[640px] flex-col gap-0 rounded-t-3xl border-border/50 bg-card p-0"
          showCloseButton
        >
          <SheetHeader className="border-b border-border/40 px-5 pt-4 pb-3">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
            <SheetTitle>AI Companion</SheetTitle>
            <SheetDescription>基于当前章节的辅助，不会取代阅读。</SheetDescription>
          </SheetHeader>
          <AiThread quote={quote} messages={messages} suggestions={suggestions} onSend={onSend} />
        </SheetContent>
      </Sheet>
    </>
  );
}
