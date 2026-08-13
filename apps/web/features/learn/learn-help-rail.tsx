'use client';

import { ArrowUpIcon, PanelRightCloseIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const HELP_QUICK_ACTIONS = [
  {
    id: 'meaning',
    label: '这句话什么意思',
    hint: '中文讲清大意',
  },
  {
    id: 'simpler',
    label: '用更简单的英语说',
    hint: '换浅一点的说法',
  },
  {
    id: 'referent',
    label: '这个词在文中指什么',
    hint: '结合上下文',
  },
] as const;

export type AssistActionId = (typeof HELP_QUICK_ACTIONS)[number]['id'] | 'explain' | 'qa' | 'lookup';

export type PendingAssist = {
  prompt: string;
  actionId: AssistActionId;
  contextText: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type LearnHelpRailProps = {
  className?: string;
  focusSentence: string;
  pendingAssist: PendingAssist | null;
  onPendingAssistHandled: () => void;
  onClose: () => void;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Stub replies for UI preview — replace with real assist API later. */
function mockAssistReply(prompt: string, contextText: string, actionId?: AssistActionId): string {
  const clip = contextText.length > 120 ? `${contextText.slice(0, 117)}…` : contextText;

  if (actionId === 'explain' || actionId === 'meaning') {
    return `大意是在说：${clip}`;
  }
  if (actionId === 'simpler') {
    return `更简单的说法：\n\n${clip}`;
  }
  if (actionId === 'referent') {
    return `结合上下文，代词多半指前面刚提到的事物。代回原词后意思会更清楚。`;
  }
  if (actionId === 'qa') {
    return `关于这段：\n\n${clip}\n\n可以先抓住主语和动作，再看修饰部分。`;
  }
  if (actionId === 'lookup') {
    return `「${clip}」：结合原文，先按语境理解词义。`;
  }

  return `可以对照这句看：\n\n${clip}`;
}

/**
 * Collapsible help rail (assist stub) for the Learning Room.
 */
export function LearnHelpRail({
  className,
  focusSentence,
  pendingAssist,
  onPendingAssistHandled,
  onClose,
}: LearnHelpRailProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextRef = useRef(focusSentence);

  const isEmpty = messages.length === 0 && !isReplying;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isReplying]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
      }
    };
  }, []);

  function sendPrompt(prompt: string, actionId?: AssistActionId, contextText = focusSentence) {
    const trimmed = prompt.trim();
    if (!trimmed || isReplying) {
      return false;
    }

    contextRef.current = contextText;
    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setIsReplying(true);

    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
    }

    replyTimerRef.current = setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: mockAssistReply(trimmed, contextRef.current, actionId),
      };
      setMessages((current) => [...current, assistantMessage]);
      setIsReplying(false);
      replyTimerRef.current = null;
    }, 700);

    return true;
  }

  useEffect(() => {
    if (!pendingAssist || isReplying) {
      return;
    }

    const timer = window.setTimeout(() => {
      const isSent = sendPrompt(pendingAssist.prompt, pendingAssist.actionId, pendingAssist.contextText);
      if (isSent) {
        onPendingAssistHandled();
      }
    }, 0);

    return () => window.clearTimeout(timer);
    // Intentionally omit sendPrompt — local function; run when pending arrives or reply frees up.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pending assist bridge
  }, [pendingAssist, isReplying]);

  return (
    <aside className={cn('flex min-h-0 flex-col', className)} aria-label="帮助">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
        <p className="font-semibold text-foreground">帮助</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
          aria-label="收起帮助"
          onClick={onClose}
        >
          <PanelRightCloseIcon className="size-4" strokeWidth={1.5} aria-hidden />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {isEmpty ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl bg-paper px-4 py-4">
              <p className="text-[0.95rem] leading-relaxed text-foreground">{focusSentence}</p>
            </div>

            <div className="grid gap-2.5">
              {HELP_QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={isReplying}
                  className={cn(
                    'rounded-2xl border border-border/80 bg-card px-4 py-3.5 text-left',
                    'transition-colors duration-300 ease-out-soft hover:bg-muted/40',
                    'disabled:pointer-events-none disabled:opacity-50',
                  )}
                  onClick={() => sendPrompt(action.label, action.id)}
                >
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.hint}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[92%] rounded-2xl bg-muted/70 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="max-w-[95%] text-sm leading-relaxed whitespace-pre-wrap text-foreground/90"
                >
                  {message.content}
                </div>
              ),
            )}

            {isReplying ? (
              <div className="flex items-center gap-1.5 py-1 text-muted-foreground" aria-label="正在回复">
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
              </div>
            ) : null}

            {!isReplying && messages.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {HELP_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    className={cn(
                      'rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground',
                      'transition-colors duration-300 ease-out-soft hover:bg-muted',
                    )}
                    onClick={() => sendPrompt(action.label, action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/80 px-4 pt-3 pb-4">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendPrompt(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="提问…"
            aria-label="提问"
            disabled={isReplying}
            className="h-11 flex-1 rounded-xl border-border bg-card px-3.5 text-sm shadow-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isReplying || draft.trim().length === 0}
            className="size-11 shrink-0 rounded-xl hover:bg-brand-deep"
            aria-label="发送"
          >
            <ArrowUpIcon className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </form>
      </div>
    </aside>
  );
}
