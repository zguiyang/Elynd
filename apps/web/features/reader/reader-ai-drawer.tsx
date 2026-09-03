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
}: {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  loading?: boolean;
  onSelectConversation: (conversationId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/40 bg-surface-container-low/70 px-4 py-3">
        <p className="font-heading text-sm font-semibold text-foreground">历史对话</p>
        <p className="mt-0.5 text-xs text-muted-foreground">只显示当前作品的 AI 记录。</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? <p className="py-8 text-center text-xs text-muted-foreground">加载历史中…</p> : null}

        {!loading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="font-heading text-sm text-foreground/80">暂无历史对话</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
              当前作品还没有 AI 记录。划词解释或提问后的对话将收录在此。
            </p>
          </div>
        ) : null}

        {!loading && conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={cn(
                    'group relative flex w-full flex-col gap-1 rounded-xl px-3.5 py-2.5 text-left transition-colors',
                    isActive
                      ? 'bg-primary/10 text-foreground font-medium before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-primary'
                      : 'text-foreground/85 hover:bg-surface-container-high/60 hover:text-foreground',
                  )}
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <p className="line-clamp-2 text-xs leading-relaxed">
                    {conversation.preview || 'Untitled conversation'}
                  </p>
                  <span className="text-[11px] text-muted-foreground/75">
                    {formatConversationTime(conversation.lastMessageAt)}
                  </span>
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
        <div className="border-b border-border/30 bg-surface-container-low/60 px-4 py-3">
          <div className="border-l-2 border-primary/60 pl-3">
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Selected</span>
            <p className="mt-0.5 line-clamp-3 font-heading text-sm italic leading-snug text-foreground/90">“{quote}”</p>
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="font-heading text-sm text-foreground/80">问一句关于正文的问题</p>
            <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
              AI 伴读会结合当前章节上下文进行解答与释义。
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'text-sm leading-[1.65]',
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-2xl rounded-tr-xs border border-border/40 bg-surface-container-high px-3.5 py-2.5 text-foreground shadow-2xs'
                  : 'mr-auto max-w-full text-foreground/95',
              )}
            >
              {m.content}
              {m.role === 'assistant' && isSending ? (
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-primary/70 align-middle" />
              ) : null}
            </div>
          ))
        )}
        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border/60 bg-surface-container-high/40 px-3 py-1.5 text-xs text-foreground/80 transition-all hover:border-primary/40 hover:bg-surface-container-high hover:text-primary active:scale-98"
                onClick={() => submit(s)}
                disabled={isSending}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-border/40 bg-surface-container-low/50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-2 py-1 shadow-2xs focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about the text..."
            className="h-9 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-0"
            disabled={isSending}
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 shrink-0 rounded-xl px-3 text-xs font-medium hover:bg-brand-deep"
            disabled={isSending || !draft.trim()}
          >
            {isSending ? '发送中' : '发送'}
          </Button>
        </div>
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
          'fixed inset-y-0 right-0 z-50 hidden w-96 flex-col border-l border-border/40 bg-surface-container-low transition-transform duration-300 ease-out-soft md:flex',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex h-14 items-center justify-between border-b border-border/40 px-4 bg-surface-container-low/90 backdrop-blur-xs">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-foreground">Gloaming Companion</p>
            <p className="truncate text-xs text-muted-foreground">
              {panel === 'history' ? '历史对话记录' : '沉浸式阅读伴读'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-8 rounded-lg text-muted-foreground hover:bg-surface-container-high hover:text-foreground',
                panel === 'history' && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              )}
              aria-label="历史对话"
              aria-pressed={panel === 'history'}
              onClick={() => (panel === 'history' ? openThread() : openHistory())}
            >
              <HistoryIcon className="size-4" strokeWidth={1.75} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
              aria-label="新建 AI 对话"
              onClick={startNewConversation}
            >
              <MessageSquarePlusIcon className="size-4" strokeWidth={1.75} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
              aria-label="关闭 AI 面板"
              onClick={closeDrawer}
            >
              <XIcon className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        {panel === 'history' ? (
          <AiHistory
            conversations={conversations}
            activeConversationId={activeConversationId}
            loading={isHistoryLoading}
            onSelectConversation={selectConversation}
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
          className="flex h-[70vh] max-h-[640px] flex-col gap-0 rounded-t-3xl border-border/40 bg-surface-container-low p-0"
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
                    'size-8 rounded-lg text-muted-foreground hover:bg-surface-container-high hover:text-foreground',
                    panel === 'history' && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                  )}
                  aria-label="历史对话"
                  aria-pressed={panel === 'history'}
                  onClick={() => (panel === 'history' ? openThread() : openHistory())}
                >
                  <HistoryIcon className="size-4" strokeWidth={1.75} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
                  aria-label="新建 AI 对话"
                  onClick={startNewConversation}
                >
                  <MessageSquarePlusIcon className="size-4" strokeWidth={1.75} />
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
