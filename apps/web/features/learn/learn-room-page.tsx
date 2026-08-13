'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  HeadphonesIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Popover, PopoverArrow, PopoverContent, PopoverDescription, PopoverTitle } from '@/components/ui/popover';
import { AUTH_ROUTES } from '@/constants';
import { formatLearnApiError, getLearnArticle, learnQueryKey } from '@/features/learn/learn-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

const ASSIST_OPEN_STORAGE_KEY = 'elynd.learn.assistOpen';

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

const SELECTION_ACTIONS = [
  { id: 'explain', label: '解释', promptLabel: '解释这句话' },
  { id: 'qa', label: '问答', promptLabel: '问答解释' },
  { id: 'lookup', label: '查词', promptLabel: '单词查询' },
] as const;

type HelpQuickId = (typeof HELP_QUICK_ACTIONS)[number]['id'];
type SelectionActionId = (typeof SELECTION_ACTIONS)[number]['id'];
type AssistActionId = HelpQuickId | SelectionActionId;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type PendingAssist = {
  prompt: string;
  actionId: AssistActionId;
  contextText: string;
};

type SelectionMenuState = {
  text: string;
};

type LearnRoomPageProps = {
  articleId: string;
};

function readAssistOpenPreference(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const raw = window.localStorage.getItem(ASSIST_OPEN_STORAGE_KEY);
  if (raw === null) {
    return false;
  }
  return raw === '1';
}

function subscribeAssistOpen(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function writeAssistOpenPreference(next: boolean) {
  window.localStorage.setItem(ASSIST_OPEN_STORAGE_KEY, next ? '1' : '0');
  window.dispatchEvent(new Event('storage'));
}

function toastComingSoon(feature: string) {
  toast.message(`${feature}即将开放`);
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSelectionPrompt(promptLabel: string, selectedText: string) {
  return `${promptLabel}：\n\n${selectedText}`;
}

/** Compact head…tail preview so long selections stay readable in the bubble. */
function formatSelectionPreview(text: string, maxChars = 48): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const ellipsis = '…';
  const budget = maxChars - ellipsis.length;
  const headLen = Math.ceil(budget / 2);
  const tailLen = Math.floor(budget / 2);
  return `${normalized.slice(0, headLen)}${ellipsis}${normalized.slice(-tailLen)}`;
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
 * Learning Room — calm editorial reader with collapsible help rail (assist stub).
 */
export function LearnRoomPage({ articleId }: LearnRoomPageProps) {
  const isAssistOpen = useSyncExternalStore(subscribeAssistOpen, readAssistOpenPreference, () => false);
  const [pendingAssist, setPendingAssist] = useState<PendingAssist | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const articleBodyRef = useRef<HTMLDivElement | null>(null);

  function setAssistOpen(next: boolean) {
    writeAssistOpenPreference(next);
  }

  const articleQuery = useQuery({
    queryKey: learnQueryKey.article(articleId),
    queryFn: ({ signal }) => getLearnArticle(articleId, { signal }),
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectionMenu(null);
      }
    }

    function onPointerUp() {
      // Mouseup may land outside the article while the selection remains inside —
      // listen on document so the bubble still opens after drag-out release.
      window.requestAnimationFrame(updateSelectionMenu);
    }

    function onSelectionChange() {
      if (!selectionMenu) {
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectionMenu(null);
        return;
      }
      if (!selectionIntersectsArticle(selection)) {
        setSelectionMenu(null);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
    // updateSelectionMenu reads latest refs/state via closure each render; rebind when menu toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selection assist listeners
  }, [selectionMenu]);

  function selectionIntersectsArticle(selection: Selection) {
    const root = articleBodyRef.current;
    if (!root || selection.rangeCount === 0) {
      return false;
    }
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const node = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement;
    return Boolean(node && root.contains(node));
  }

  function updateSelectionMenu() {
    const root = articleBodyRef.current;
    const selection = window.getSelection();
    if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionMenu(null);
      return;
    }

    const text = selection.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 1 || !selectionIntersectsArticle(selection)) {
      setSelectionMenu(null);
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelectionMenu(null);
      return;
    }

    setSelectionMenu({ text });
  }

  function getSelectionAnchor() {
    return {
      contextElement: articleBodyRef.current ?? undefined,
      getBoundingClientRect() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          return new DOMRect();
        }
        const anchorNode = selection.anchorNode;
        if (!anchorNode || !articleBodyRef.current?.contains(anchorNode)) {
          return new DOMRect();
        }
        return selection.getRangeAt(0).getBoundingClientRect();
      },
    };
  }

  function runSelectionAction(action: (typeof SELECTION_ACTIONS)[number]) {
    if (!selectionMenu) {
      return;
    }
    const selectedText = selectionMenu.text;
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
    setAssistOpen(true);
    setPendingAssist({
      prompt: buildSelectionPrompt(action.promptLabel, selectedText),
      actionId: action.id,
      contextText: selectedText,
    });
  }

  const article = articleQuery.data;
  const isNotFound = articleQuery.error instanceof ApiRequestError && articleQuery.error.status === 404;

  if (articleQuery.isPending) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>找不到这篇文章</EmptyTitle>
            <EmptyDescription>可能已下架或链接无效。</EmptyDescription>
          </EmptyHeader>
          <Button
            nativeButton={false}
            className="mt-6 h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            回今日
          </Button>
        </Empty>
      </div>
    );
  }

  if (articleQuery.isError || !article) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>暂时无法加载</EmptyTitle>
            <EmptyDescription>{formatLearnApiError(articleQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const paragraphs = paragraphsFromBody(article.body);
  const levelLabel = LEVEL_LABEL[article.level];
  const metaParts = [
    levelLabel,
    article.estimatedMinutes != null ? `约 ${article.estimatedMinutes} 分钟` : null,
  ].filter(Boolean);
  const focusSentence = paragraphs[0] ?? article.title;

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="z-30 shrink-0 border-b border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6 lg:px-8">
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-10 shrink-0 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
            返回
          </Button>
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="书签"
              onClick={() => toastComingSoon('书签')}
            >
              <BookmarkIcon className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label={isAssistOpen ? '收起帮助' : '展开帮助'}
              aria-pressed={isAssistOpen}
              onClick={() => setAssistOpen(!isAssistOpen)}
            >
              {isAssistOpen ? (
                <PanelRightCloseIcon className="size-4" strokeWidth={1.5} aria-hidden />
              ) : (
                <PanelRightOpenIcon className="size-4" strokeWidth={1.5} aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <section className="min-w-0 flex-1 overflow-y-auto px-5 py-10 md:px-8 md:py-14 lg:px-12">
          <article
            className={cn(
              'mx-auto transition-[max-width] duration-300 ease-out-soft',
              isAssistOpen ? 'max-w-3xl' : 'max-w-3xl lg:max-w-4xl',
            )}
          >
            {metaParts.length > 0 ? <p className="text-sm text-muted-foreground">{metaParts.join(' · ')}</p> : null}

            <h1
              className={cn(
                'font-heading text-4xl font-bold tracking-tight text-foreground text-pretty md:text-5xl',
                metaParts.length > 0 ? 'mt-4' : null,
              )}
            >
              {article.title}
            </h1>

            <div
              ref={articleBodyRef}
              className="mt-10 flex max-w-[42rem] flex-col gap-7 text-lg leading-loose text-foreground/90"
            >
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
              ) : (
                <p className="text-muted-foreground">这篇还没有正文。</p>
              )}
            </div>
          </article>
        </section>

        {isAssistOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 bg-foreground/20 lg:hidden"
              aria-label="关闭帮助"
              onClick={() => setAssistOpen(false)}
            />
            <HelpRail
              className={cn(
                'z-20 flex w-[min(28rem,100%)] shrink-0 flex-col border-l border-border bg-sidebar',
                'max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-card',
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-300',
              )}
              focusSentence={focusSentence}
              pendingAssist={pendingAssist}
              onPendingAssistHandled={() => setPendingAssist(null)}
              onClose={() => setAssistOpen(false)}
            />
          </>
        ) : null}
      </div>

      <footer className="z-30 shrink-0 border-t border-border/80 bg-sidebar/95 backdrop-blur-sm">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-center sm:gap-4 md:px-8">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
            onClick={() => toastComingSoon('听读')}
          >
            <HeadphonesIcon className="size-4" strokeWidth={1.5} aria-hidden />
            听一听
          </Button>
          {article.practiceAvailable ? (
            <Button
              nativeButton={false}
              variant="outline"
              className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
              render={<Link href={AUTH_ROUTES.learnPractice(articleId)} />}
            >
              <CheckIcon className="size-4" strokeWidth={1.5} aria-hidden />
              练几道小题
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-border bg-card px-5 shadow-none"
              disabled
              title="这篇还没有练习题"
            >
              <CheckIcon className="size-4" strokeWidth={1.5} aria-hidden />
              练几道小题
            </Button>
          )}
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            回今日
          </Button>
        </div>
      </footer>

      <Popover
        open={selectionMenu !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectionMenu(null);
          }
        }}
        modal={false}
      >
        {selectionMenu ? (
          <PopoverContent
            anchor={getSelectionAnchor}
            side="top"
            sideOffset={12}
            align="center"
            collisionPadding={12}
            className={cn(
              'relative w-[min(17.5rem,calc(100vw-1.5rem))] gap-0 overflow-visible rounded-2xl border-0 bg-transparent p-0',
              'shadow-none ring-0',
            )}
            onMouseDown={(event) => {
              // Keep the text selection while interacting with the toolbar.
              event.preventDefault();
            }}
          >
            <PopoverArrow />
            <div className="overflow-hidden rounded-2xl bg-card shadow-float ring-1 ring-foreground/10">
              <PopoverTitle className="sr-only">选中文本</PopoverTitle>
              <PopoverDescription className="px-3.5 pt-3 pb-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {formatSelectionPreview(selectionMenu.text)}
              </PopoverDescription>

              <div className="border-t border-border/70" role="toolbar" aria-label="选中文本操作">
                <div className="flex divide-x divide-border/70">
                  {SELECTION_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={cn(
                        'h-9 min-w-0 flex-1 px-2.5 text-[13px] font-medium tracking-tight text-foreground/90',
                        'transition-[color,background-color,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
                        'hover:bg-muted/55 hover:text-foreground',
                        'active:scale-[0.98] active:bg-muted/80',
                        'focus-visible:bg-muted/55 focus-visible:outline-none',
                      )}
                      onClick={() => runSelectionAction(action)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
}

function HelpRail({
  className,
  focusSentence,
  pendingAssist,
  onPendingAssistHandled,
  onClose,
}: {
  className?: string;
  focusSentence: string;
  pendingAssist: PendingAssist | null;
  onPendingAssistHandled: () => void;
  onClose: () => void;
}) {
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
