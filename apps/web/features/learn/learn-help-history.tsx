'use client';

import { useQuery } from '@tanstack/react-query';
import { HistoryIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  conversationQueryKey,
  formatConversationApiError,
  listArticleAssistConversations,
} from '@/features/learn/conversation-api';
import { cn } from '@/lib/utils';

type LearnHelpHistoryProps = {
  articleId: string;
  activeConversationId: string | null;
  disabled?: boolean;
  onSelect: (conversationId: string) => void;
};

function formatHistoryTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Article-scoped assist conversation history sheet for the Learning Room help rail.
 */
export function LearnHelpHistory({ articleId, activeConversationId, disabled, onSelect }: LearnHelpHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const listQuery = useQuery({
    queryKey: conversationQueryKey.list({ articleId }),
    queryFn: ({ signal }) => listArticleAssistConversations(articleId, { signal }),
    enabled: isOpen,
  });

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (disabled && next) {
          return;
        }
        setIsOpen(next);
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            aria-label="历史记录"
          />
        }
      >
        <HistoryIcon className="size-4" strokeWidth={1.5} aria-hidden />
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/80 px-5 py-4 text-left">
          <SheetTitle>历史记录</SheetTitle>
          <SheetDescription>这篇的过往帮助对话，点开可继续聊。</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
          {listQuery.isPending ? <p className="px-2 py-6 text-sm text-muted-foreground">加载中…</p> : null}

          {listQuery.isError ? (
            <p className="px-2 py-6 text-sm text-destructive">{formatConversationApiError(listQuery.error)}</p>
          ) : null}

          {listQuery.isSuccess && listQuery.data.items.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">还没有历史对话。</p>
          ) : null}

          {listQuery.isSuccess ? (
            <ul className="flex flex-col gap-1">
              {listQuery.data.items.map((item) => {
                const isActive = item.id === activeConversationId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-colors duration-300 ease-out-soft',
                        isActive ? 'bg-brand-soft text-brand-deep' : 'hover:bg-muted/70',
                      )}
                      onClick={() => {
                        onSelect(item.id);
                        setIsOpen(false);
                      }}
                    >
                      <span className="line-clamp-2 text-sm leading-relaxed text-foreground">
                        {item.preview.trim() || '（无预览）'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatHistoryTime(item.lastMessageAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
