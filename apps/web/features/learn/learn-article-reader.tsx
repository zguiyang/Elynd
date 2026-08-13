'use client';

import { useEffect, useRef, useState } from 'react';

import { type ArticleLevel } from '@elynd/shared/api/articles';

import { Popover, PopoverArrow, PopoverContent, PopoverDescription, PopoverTitle } from '@/components/ui/popover';
import { type AssistActionId, type PendingAssist } from '@/features/learn/learn-help-rail';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { cn } from '@/lib/utils';

const SELECTION_ACTIONS = [
  { id: 'explain', label: '解释', promptLabel: '解释这句话' },
  { id: 'qa', label: '问答', promptLabel: '问答解释' },
  { id: 'lookup', label: '查词', promptLabel: '单词查询' },
] as const satisfies ReadonlyArray<{
  id: AssistActionId;
  label: string;
  promptLabel: string;
}>;

type SelectionMenuState = {
  text: string;
};

type LearnArticleReaderProps = {
  title: string;
  body: string;
  level: ArticleLevel;
  estimatedMinutes: number | null;
  isAssistOpen: boolean;
  onAssistRequest: (pending: PendingAssist) => void;
};

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

/**
 * Article body + text-selection assist popover for the Learning Room.
 */
export function LearnArticleReader({
  title,
  body,
  level,
  estimatedMinutes,
  isAssistOpen,
  onAssistRequest,
}: LearnArticleReaderProps) {
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const articleBodyRef = useRef<HTMLDivElement | null>(null);

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
    onAssistRequest({
      prompt: buildSelectionPrompt(action.promptLabel, selectedText),
      actionId: action.id,
      contextText: selectedText,
    });
  }

  const paragraphs = paragraphsFromBody(body);
  const levelLabel = LEVEL_LABEL[level];
  const metaParts = [levelLabel, estimatedMinutes != null ? `约 ${estimatedMinutes} 分钟` : null].filter(Boolean);

  return (
    <>
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
            {title}
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
    </>
  );
}
