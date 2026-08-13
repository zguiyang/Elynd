'use client';

import { ArrowUpIcon, PanelRightCloseIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

import { type AssistActionId as SharedAssistActionId } from '@elynd/shared/api/assist';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { askAssistStream, formatAssistLearnerError } from '@/features/learn/assist-api';
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
  articleId: string;
  focusSentence: string;
  pendingAssist: PendingAssist | null;
  onPendingAssistHandled: () => void;
  onClose: () => void;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAskActionId(actionId: AssistActionId | undefined): SharedAssistActionId {
  return actionId ?? 'qa';
}

/**
 * Collapsible help rail for the Learning Room — streams assist replies over SSE.
 */
export function LearnHelpRail({
  className,
  articleId,
  focusSentence,
  pendingAssist,
  onPendingAssistHandled,
  onClose,
}: LearnHelpRailProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contextRef = useRef(focusSentence);

  const isEmpty = messages.length === 0 && !isReplying;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isReplying]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function sendPrompt(prompt: string, actionId?: AssistActionId, contextText = focusSentence) {
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
    const assistantId = createMessageId();

    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '' }]);
    setDraft('');
    setIsReplying(true);

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const askActionId = toAskActionId(actionId);
    const question = askActionId === 'qa' ? trimmed : undefined;

    try {
      await askAssistStream(
        {
          articleId,
          actionId: askActionId,
          selection: contextText.trim() || focusSentence,
          question,
        },
        {
          onDelta: (text) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: message.content + text } : message,
              ),
            );
          },
          onDone: (done) => {
            setMessages((current) =>
              current.map((message) => (message.id === assistantId ? { ...message, content: done.reply } : message)),
            );
          },
        },
        { signal: abort.signal },
      );
    } catch (error) {
      if (abort.signal.aborted) {
        setMessages((current) =>
          current.filter((message) => message.id !== assistantId || message.content.trim().length > 0),
        );
        return true;
      }
      const message = formatAssistLearnerError(error);
      toast.error(message);
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: item.content.trim() || message } : item)),
      );
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
      }
      setIsReplying(false);
    }

    return true;
  }

  useEffect(() => {
    if (!pendingAssist || isReplying) {
      return;
    }

    const timer = window.setTimeout(() => {
      void sendPrompt(pendingAssist.prompt, pendingAssist.actionId, pendingAssist.contextText).then((isSent) => {
        if (isSent) {
          onPendingAssistHandled();
        }
      });
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
                  onClick={() => void sendPrompt(action.label, action.id)}
                >
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.hint}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            {messages.map((message, index) => {
              if (message.role === 'user') {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[92%] rounded-2xl bg-muted/70 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      {message.content}
                    </div>
                  </div>
                );
              }

              const isStreamingMessage = isReplying && index === messages.length - 1;

              return (
                <div key={message.id} className="max-w-[95%] text-sm leading-relaxed text-foreground/90">
                  {message.content ? (
                    <Streamdown
                      className="[&_*]:leading-relaxed [&_ol]:my-2 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2"
                      controls={false}
                      isAnimating={isStreamingMessage}
                      mode={isStreamingMessage ? 'streaming' : 'static'}
                    >
                      {message.content}
                    </Streamdown>
                  ) : null}
                </div>
              );
            })}

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
                    onClick={() => void sendPrompt(action.label, action.id)}
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
            void sendPrompt(draft);
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
