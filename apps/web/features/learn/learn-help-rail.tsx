'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

import { type AssistActionId as SharedAssistActionId } from '@gloaming/shared/api/assist';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { askAssistStream, formatAssistLearnerError } from '@/features/learn/assist-api';
import {
  conversationQueryKey,
  createAssistConversation,
  formatConversationApiError,
  getConversation,
} from '@/features/learn/conversation-api';
import { LearnHelpHistory } from '@/features/learn/learn-help-history';
import { cn } from '@/lib/utils';

const INTRO_MESSAGE =
  '我是这篇的阅读帮手。划词可以查、可以问这句话什么意思；也可以问英语学习上的问题。其它学科我帮不了。';

const COMPOSER_CHIPS = [
  { id: 'gist' as const, label: '总结大意', needsSelection: false },
  { id: 'meaning' as const, label: '这句话什么意思', needsSelection: true },
  { id: 'simpler' as const, label: '换简单说法', needsSelection: true },
] as const;

export type AssistActionId = SharedAssistActionId;

export type PendingAssist = {
  prompt: string;
  actionId: AssistActionId;
  contextText: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Static welcome; not an API reply — no follow-up chips. */
  isIntro?: boolean;
};

type LearnHelpRailProps = {
  className?: string;
  articleId: string;
  pendingAssist: PendingAssist | null;
  onPendingAssistHandled: () => void;
  onClose: () => void;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createIntroMessage(): ChatMessage {
  return {
    id: 'intro',
    role: 'assistant',
    content: INTRO_MESSAGE,
    isIntro: true,
  };
}

/**
 * Collapsible help rail for the Learning Room — streams assist replies over SSE,
 * persists turns server-side, and supports new chat / history resume.
 */
export function LearnHelpRail({
  className,
  articleId,
  pendingAssist,
  onPendingAssistHandled,
  onClose,
}: LearnHelpRailProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createIntroMessage()]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [followUpsForMessageId, setFollowUpsForMessageId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSelectionRef = useRef('');
  const conversationIdRef = useRef<string | null>(null);
  const skipIntroRef = useRef(Boolean(pendingAssist));

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (skipIntroRef.current) {
      setMessages([]);
      skipIntroRef.current = false;
    }
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isReplying, followUps]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function resetComposerState() {
    setDraft('');
    setFollowUps([]);
    setFollowUpsForMessageId(null);
  }

  async function handleNewChat() {
    if (isReplying || isStartingNew || isLoadingHistory) {
      return;
    }
    abortRef.current?.abort();
    setIsStartingNew(true);
    try {
      const created = await createAssistConversation(articleId);
      setConversationId(created.id);
      setMessages([createIntroMessage()]);
      resetComposerState();
      void queryClient.invalidateQueries({ queryKey: conversationQueryKey.list({ articleId }) });
    } catch (error) {
      toast.error(formatConversationApiError(error));
    } finally {
      setIsStartingNew(false);
    }
  }

  async function handleSelectHistory(id: string) {
    if (isReplying || isStartingNew || isLoadingHistory) {
      return;
    }
    abortRef.current?.abort();
    setIsLoadingHistory(true);
    try {
      const detail = await getConversation(id);
      setConversationId(detail.id);
      setMessages(
        detail.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        })),
      );
      resetComposerState();
      const lastAssistant = [...detail.messages].reverse().find((message) => message.role === 'assistant');
      const suggestions = lastAssistant?.metadata.suggestions;
      if (lastAssistant && suggestions?.length) {
        setFollowUps(suggestions);
        setFollowUpsForMessageId(lastAssistant.id);
      }
      const lastUserWithSelection = [...detail.messages]
        .reverse()
        .find((message) => message.role === 'user' && message.metadata.selection?.trim());
      if (lastUserWithSelection?.metadata.selection) {
        lastSelectionRef.current = lastUserWithSelection.metadata.selection;
      }
    } catch (error) {
      toast.error(formatConversationApiError(error));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function sendPrompt(prompt: string, actionId?: AssistActionId, contextText?: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isReplying || isStartingNew || isLoadingHistory) {
      return false;
    }

    const askActionId: SharedAssistActionId = actionId ?? 'qa';
    const selection = (contextText ?? lastSelectionRef.current).trim();

    if (askActionId !== 'gist' && askActionId !== 'qa' && !selection) {
      toast.message('先在正文划一段');
      return false;
    }

    if (selection) {
      lastSelectionRef.current = selection;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmed,
    };
    const assistantId = createMessageId();

    setMessages((current) => {
      const withoutIntro = current.filter((message) => !message.isIntro);
      return [...withoutIntro, userMessage, { id: assistantId, role: 'assistant', content: '' }];
    });
    setDraft('');
    setFollowUps([]);
    setFollowUpsForMessageId(null);
    setIsReplying(true);

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const question = askActionId === 'qa' ? trimmed : undefined;
    const activeConversationId = conversationIdRef.current;

    try {
      await askAssistStream(
        {
          articleId,
          actionId: askActionId,
          ...(selection ? { selection } : {}),
          ...(question ? { question } : {}),
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
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
            if (done.conversationId) {
              setConversationId(done.conversationId);
            }
            if (done.suggestions?.length) {
              setFollowUps(done.suggestions);
              setFollowUpsForMessageId(assistantId);
            }
            void queryClient.invalidateQueries({ queryKey: conversationQueryKey.list({ articleId }) });
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

  function runComposerChip(chip: (typeof COMPOSER_CHIPS)[number]) {
    if (chip.needsSelection && !lastSelectionRef.current.trim()) {
      toast.message('先在正文划一段');
      return;
    }
    void sendPrompt(chip.label, chip.id, lastSelectionRef.current || undefined);
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

  const isChromeBusy = isReplying || isStartingNew || isLoadingHistory;

  return (
    <aside className={cn('flex min-h-0 flex-col', className)} aria-label="帮助">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3 py-3 sm:px-5 sm:py-4">
        <p className="min-w-0 flex-1 truncate font-semibold text-foreground">帮助</p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isChromeBusy}
            className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="新对话"
            onClick={() => void handleNewChat()}
          >
            <PlusIcon className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
          <LearnHelpHistory
            articleId={articleId}
            activeConversationId={conversationId}
            disabled={isChromeBusy}
            onSelect={(id) => void handleSelectHistory(id)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="关闭帮助"
            onClick={onClose}
          >
            <XIcon className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {isLoadingHistory ? <p className="mb-4 text-sm text-muted-foreground">加载对话…</p> : null}
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
            const shouldShowFollowUps =
              !isReplying && followUpsForMessageId === message.id && followUps.length > 0 && !message.isIntro;

            return (
              <div key={message.id} className="flex max-w-[95%] flex-col gap-2.5">
                <div className="text-sm leading-relaxed text-foreground/90">
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

                {shouldShowFollowUps ? (
                  <div className="flex flex-wrap gap-2">
                    {followUps.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className={cn(
                          'rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground',
                          'transition-colors duration-300 ease-out-soft hover:bg-muted',
                        )}
                        onClick={() => void sendPrompt(suggestion, 'qa', lastSelectionRef.current || undefined)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
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

          <div ref={threadEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border/80 px-4 pt-3 pb-4">
        <div className="mb-2.5 flex flex-wrap gap-2">
          {COMPOSER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={isChromeBusy}
              className={cn(
                'rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground',
                'transition-colors duration-300 ease-out-soft hover:bg-muted',
                'disabled:pointer-events-none disabled:opacity-50',
              )}
              onClick={() => runComposerChip(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>

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
            disabled={isChromeBusy}
            className="h-11 flex-1 rounded-xl border-border bg-card px-3.5 text-sm shadow-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isChromeBusy || draft.trim().length === 0}
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
