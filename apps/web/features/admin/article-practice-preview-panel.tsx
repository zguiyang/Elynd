'use client';

import { useState } from 'react';

import { type PracticeItemKind, practiceOptionLetter } from '@gloaming/shared/api/learn';

import { Button } from '@/components/ui/button';
import type { AdminPracticeDraftItem } from '@/features/admin/article-practice-api';
import { cn } from '@/lib/utils';

type ArticlePracticePreviewPanelProps = {
  items: AdminPracticeDraftItem[];
};

function itemPrompt(item: AdminPracticeDraftItem): string {
  if (item.kind === 'comprehension' && 'prompt' in item.payload) {
    return item.payload.prompt;
  }
  if (item.kind === 'vocab' && 'word' in item.payload) {
    return `${item.payload.word} — ${item.payload.hint}`;
  }
  return '（题目）';
}

function itemOptions(item: AdminPracticeDraftItem): string[] {
  return item.payload.options;
}

const KIND_LABEL: Record<PracticeItemKind, string> = {
  comprehension: '理解',
  vocab: '词汇',
};

/**
 * Admin preview of learner-facing practice flow (no attempt persistence).
 */
export function ArticlePracticePreviewPanel({ items }: ArticlePracticePreviewPanelProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-paper/60 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">还没有草稿题目。请先在「生成」里出题。</p>
      </section>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex]!;
  const options = itemOptions(item);

  return (
    <section className="rounded-3xl border border-border bg-paper px-6 py-7 md:px-10 md:py-9">
      <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">运营预览</p>
      <p className="mt-2 text-sm text-muted-foreground">
        模拟学习者做题界面；点选不会保存作答。正确答案：{practiceOptionLetter(item.correctOptionIndex)}
      </p>

      <div className="mt-8 max-w-xl">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {KIND_LABEL[item.kind]} · {safeIndex + 1} / {items.length}
        </p>
        <h3 className="mt-3 font-heading text-xl font-semibold tracking-tight text-foreground">{itemPrompt(item)}</h3>
        {item.kind === 'vocab' && 'quote' in item.payload ? (
          <p className="mt-3 border-l-2 border-border pl-3 text-sm text-muted-foreground italic">
            {item.payload.quote}
          </p>
        ) : null}

        <ul className="mt-6 flex flex-col gap-2">
          {options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = optionIndex === item.correctOptionIndex;
            return (
              <li key={`${safeIndex}-${optionIndex}`}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-300 ease-out-soft',
                    isSelected
                      ? isCorrect
                        ? 'border-brand/40 bg-accent text-accent-foreground'
                        : 'border-destructive/40 bg-destructive/5 text-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted/40',
                  )}
                  onClick={() => setSelected(optionIndex)}
                >
                  <span className="mr-2 font-medium text-muted-foreground">{practiceOptionLetter(optionIndex)}.</span>
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={safeIndex <= 0}
            onClick={() => {
              setIndex((prev) => Math.max(0, prev - 1));
              setSelected(null);
            }}
          >
            上一题
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={safeIndex >= items.length - 1}
            onClick={() => {
              setIndex((prev) => Math.min(items.length - 1, prev + 1));
              setSelected(null);
            }}
          >
            下一题
          </Button>
        </div>
      </div>
    </section>
  );
}
