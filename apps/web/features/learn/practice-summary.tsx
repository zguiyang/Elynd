'use client';

import { CheckCircleIcon } from 'lucide-react';
import Link from 'next/link';

import type { PracticeAttemptResult } from '@elynd/shared/api/learn';
import { practiceOptionLetter } from '@elynd/shared/api/learn';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

type PracticeSummaryProps = {
  result: PracticeAttemptResult;
  /** AI advice when available; null shows a one-line soft fallback. */
  advice: string | null;
};

/**
 * Post-practice summary: typography score, thin advice strip, compact review list.
 */
export function PracticeSummary({ result, advice }: PracticeSummaryProps) {
  const isAllCorrect = result.correctCount === result.totalCount;
  const wrongCount = result.totalCount - result.correctCount;
  const headline = isAllCorrect
    ? '全部正确'
    : result.correctCount === 0
      ? '这轮先熟悉一下就好'
      : `对了 ${result.correctCount} 题，错了 ${wrongCount} 题`;

  return (
    <section className="flex min-h-[min(70dvh,36rem)] flex-col">
      <div className="shrink-0">
        <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">练习总结</p>
        <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight md:text-4xl">{headline}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          答对 {result.correctCount} / {result.totalCount}
          。下面对照你的选择与正确答案——不是考试排名，只帮你看清哪里还差点。
        </p>

        <div className="mt-6 rounded-2xl bg-paper px-5 py-4 md:px-6">
          {advice ? (
            <p className="text-base leading-relaxed text-foreground/90">{advice}</p>
          ) : (
            <p className="text-sm text-muted-foreground">建议暂不可用，可先看下面的对照</p>
          )}
        </div>
      </div>

      <ul className="mt-6 min-h-0 flex-1 divide-y divide-border/80 overflow-y-auto border-y border-border/80">
        {result.items.map((item, index) => {
          const kindLabel = item.kind === 'vocab' ? '文中的词' : '理解确认';
          if (item.isCorrect) {
            return (
              <li key={item.practiceItemId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="text-brand-deep">{index + 1}</span>
                  <span className="mx-1.5 text-border">·</span>
                  {kindLabel}
                  <span className="mx-1.5 text-border">·</span>
                  <span className="text-foreground/80">{item.label}</span>
                </span>
                <span className="font-medium text-brand-deep">正确</span>
              </li>
            );
          }

          const selectedText =
            item.selectedOptionIndex == null ? null : (item.options[item.selectedOptionIndex] ?? null);
          const correctText = item.options[item.correctOptionIndex] ?? '';

          return (
            <li key={item.practiceItemId} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="tracking-wide text-brand-deep">
                  {kindLabel} · {index + 1}
                </span>
                <span className="font-medium text-destructive">不正确</span>
              </div>
              <p className="font-heading mt-2 text-lg font-semibold tracking-tight text-foreground">{item.label}</p>
              <div className="mt-3 space-y-1.5 text-sm leading-relaxed">
                <p className="text-muted-foreground">
                  你的选择：
                  <span className="ml-1 text-foreground">
                    {selectedText == null
                      ? '未作答'
                      : `${practiceOptionLetter(item.selectedOptionIndex!)}. ${selectedText}`}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  正确答案：
                  <span className="ml-1 text-foreground">
                    {practiceOptionLetter(item.correctOptionIndex)}. {correctText}
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div
        className={cn('sticky bottom-0 mt-6 shrink-0 border-t border-border/60 bg-background/95 py-4 backdrop-blur-sm')}
      >
        <Button
          nativeButton={false}
          className="h-12 w-full gap-2 rounded-2xl hover:bg-brand-deep sm:w-auto sm:px-8"
          render={<Link href={AUTH_ROUTES.dashboard} />}
        >
          <CheckCircleIcon className="size-4" strokeWidth={1.5} aria-hidden />
          回今日
        </Button>
      </div>
    </section>
  );
}
