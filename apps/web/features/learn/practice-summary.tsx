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
};

/**
 * Post-practice score summary with selected vs correct options (no AI).
 */
export function PracticeSummary({ result }: PracticeSummaryProps) {
  const isAllCorrect = result.correctCount === result.totalCount;
  const wrongCount = result.totalCount - result.correctCount;
  const headline = isAllCorrect
    ? '全部正确'
    : result.correctCount === 0
      ? '这轮先熟悉一下就好'
      : `对了 ${result.correctCount} 题，错了 ${wrongCount} 题`;

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-[1.75rem] border border-border bg-card p-8 md:p-10">
        <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">练习总结</p>
        <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight">{headline}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          答对 {result.correctCount} / {result.totalCount}
          。下面对照你的选择与正确答案——不是考试排名，只帮你看清哪里还差点。
        </p>
      </div>

      <ul className="flex flex-col gap-4">
        {result.items.map((item, index) => {
          const selectedText =
            item.selectedOptionIndex == null ? null : (item.options[item.selectedOptionIndex] ?? null);
          const correctText = item.options[item.correctOptionIndex] ?? '';
          return (
            <li key={item.practiceItemId} className="rounded-[1.5rem] border border-border bg-card px-5 py-5 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="tracking-wide text-brand-deep">
                  {item.kind === 'vocab' ? '文中的词' : '理解确认'} · {index + 1}
                </span>
                <span className={cn('font-medium', item.isCorrect ? 'text-brand-deep' : 'text-destructive')}>
                  {item.isCorrect ? '正确' : '不正确'}
                </span>
              </div>
              <p className="font-heading mt-3 text-lg font-semibold tracking-tight text-foreground">{item.label}</p>
              <div className="mt-4 space-y-2 text-sm leading-relaxed">
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

      <Button
        nativeButton={false}
        className="h-12 w-full gap-2 rounded-2xl hover:bg-brand-deep sm:w-auto sm:px-8"
        render={<Link href={AUTH_ROUTES.dashboard} />}
      >
        <CheckCircleIcon className="size-4" strokeWidth={1.5} aria-hidden />
        回今日
      </Button>
    </section>
  );
}
