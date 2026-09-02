'use client';

import { HistoryIcon, MessageSquarePlusIcon, XIcon } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import type { ConversationSummary } from '@gloaming/shared/api/conversations';

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
  conversations: ConversationSummary[];
  activeConversationId?: string;
  isHistoryLoading?: boolean;
  isSending?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onStartNewConversation: () => void;
};

type DrawerPanel = 'thread' | 'history';

function formatConversationTime(value: string | Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function AiHistory({
  conversations,
  activeConversationId,
  loading,
  onSelectConversation,
  onStartNewConversation,
}: {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  loading?: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStartNewConversation: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/40 bg-surface-container-low/70 px-4 py-3">
        <p className="font-heading text-sm font-semibold text-foreground">历史对话</p>
        <p className="mt-1 text-xs text-muted-foreground">只显示当前作品的 AI 记录。</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Button
          type="button"
          variant="outline"
          className="mb-3 h-10 w-full justify-start rounded-xl border-border/60 bg-card text-sm"
          onClick={onStartNewConversation}
        >
          <MessageSquarePlusIcon className="mr-2 size-4" strokeWidth={1.6} />
          新建 AI 对话
        </Button>

        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">加载历史中…</p> : null}

        {!loading && conversations.length === 0 ? (
          <p className="rounded-2xl border border-border/50 bg-surface-container-low/70 px-4 py-5 text-sm leading-relaxed text-muted-foreground">
            当前作品还没有 AI 历史。行内解释或提问完成后会出现在这里。
          </p>
        ) : null}

        {!loading && conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    'w-full rounded-2xl border px-3.5 py-3 text-left transition-colors',
                    isActive
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border/50 bg-card/80 text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <p className="line-clamp-2 text-xs leading-relaxed">
                    {conversation.preview || 'Untitled conversation'}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatConversationTime(conversation.lastMessageAt)}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AiThread({
  quote,
  messages,
  suggestions,
  isSending,
  error,
  onSend,
}: {
  quote: string | null;
  messages: ReaderAiMessage[];
  suggestions: string[];
  isSending?: boolean;
  error?: string | null;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
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
              {m.content || (m.role === 'assistant' && isSending ? <span className="animate-pulse">▍</span> : null)}
            </div>
          ))
        )}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                onClick={() => submit(s)}
                disabled={isSending}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
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
          disabled={isSending}
        />
        <Button type="submit" className="h-10 shrink-0 rounded-xl px-4 hover:bg-brand-deep" disabled={isSending}>
          {isSending ? '发送中' : '发送'}
        </Button>
      </form>
    </div>
  );
}

export function ReaderAiDrawer({
  open,
  quote,
  messages,
  suggestions,
  conversations,
  activeConversationId,
  isHistoryLoading,
  isSending,
  error,
  onOpenChange,
  onSend,
  onSelectConversation,
  onStartNewConversation,
}: ReaderAiDrawerProps) {
  const isDesktop = useIsDesktop();
  const isSheetOpen = open && !isDesktop;
  const [panel, setPanel] = useState<DrawerPanel>('thread');

  function openThread() {
    setPanel('thread');
  }

  function openHistory() {
    setPanel('history');
  }

  function selectConversation(conversationId: string) {
    onSelectConversation(conversationId);
    openThread();
  }

  function startNewConversation() {
    onStartNewConversation();
    openThread();
  }

  function closeDrawer() {
    openThread();
    onOpenChange(false);
  }

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
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-foreground">Gloaming Companion</p>
            <p className="truncate text-xs text-muted-foreground">
              {panel === 'history' ? '当前作品的历史对话' : 'Ask about the text'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-9 text-muted-foreground hover:text-foreground',
                panel === 'history' && 'bg-accent text-brand-deep',
              )}
              aria-label="历史对话"
              aria-pressed={panel === 'history'}
              onClick={() => (panel === 'history' ? openThread() : openHistory())}
            >
              <HistoryIcon className="size-4" strokeWidth={1.6} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label="新建 AI 对话"
              onClick={startNewConversation}
            >
              <MessageSquarePlusIcon className="size-4" strokeWidth={1.6} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label="关闭 AI 面板"
              onClick={closeDrawer}
            >
              <XIcon className="size-4" strokeWidth={1.6} />
            </Button>
          </div>
        </div>
        {panel === 'history' ? (
          <AiHistory
            conversations={conversations}
            activeConversationId={activeConversationId}
            loading={isHistoryLoading}
            onSelectConversation={selectConversation}
            onStartNewConversation={startNewConversation}
          />
        ) : (
          <AiThread
            quote={quote}
            messages={messages}
            suggestions={suggestions}
            isSending={isSending}
            error={error}
            onSend={onSend}
          />
        )}
      </aside>

      <Sheet open={isSheetOpen} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : closeDrawer())}>
        <SheetContent
          side="bottom"
          className="flex h-[70vh] max-h-[640px] flex-col gap-0 rounded-t-3xl border-border/50 bg-card p-0"
          showCloseButton
        >
          <SheetHeader className="border-b border-border/40 px-5 pt-4 pb-3">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-left">
                <SheetTitle>Gloaming Companion</SheetTitle>
                <SheetDescription>
                  {panel === 'history' ? '当前作品的历史对话。' : '基于当前章节的辅助，不会取代阅读。'}
                </SheetDescription>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-9 text-muted-foreground hover:text-foreground',
                    panel === 'history' && 'bg-accent text-brand-deep',
                  )}
                  aria-label="历史对话"
                  aria-pressed={panel === 'history'}
                  onClick={() => (panel === 'history' ? openThread() : openHistory())}
                >
                  <HistoryIcon className="size-4" strokeWidth={1.6} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="新建 AI 对话"
                  onClick={startNewConversation}
                >
                  <MessageSquarePlusIcon className="size-4" strokeWidth={1.6} />
                </Button>
              </div>
            </div>
          </SheetHeader>
          {panel === 'history' ? (
            <AiHistory
              conversations={conversations}
              activeConversationId={activeConversationId}
              loading={isHistoryLoading}
              onSelectConversation={selectConversation}
              onStartNewConversation={startNewConversation}
            />
          ) : (
            <AiThread
              quote={quote}
              messages={messages}
              suggestions={suggestions}
              isSending={isSending}
              error={error}
              onSend={onSend}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
