'use client';

import { ArrowLeftIcon, BookOpenIcon, CheckCircleIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import { getLearnStaticArticle, type LearnPracticeQuestion } from '@/features/learn/learn-static-data';
import { cn } from '@/lib/utils';

type LearnPracticePageProps = {
  articleId: string;
};

/**
 * Prototype / stub Practice — static questions, local UI state only.
 * Single-column one-at-a-time flow (design: Q4-B).
 */
export function LearnPracticePage({ articleId }: LearnPracticePageProps) {
  const article = getLearnStaticArticle(articleId);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  if (!article) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>找不到这篇演示练习</EmptyTitle>
            <EmptyDescription>回今日重新打开一篇演示阅读即可。</EmptyDescription>
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

  const questions = article.practiceQuestions;
  const total = questions.length;
  const question = questions[index];
  const isLast = index >= total - 1;

  function goNext() {
    if (isLast) {
      setIsFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="border-b border-border/80 bg-sidebar">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 md:px-8">
          <div className="min-w-0">
            <p className="text-sm tracking-wide text-brand-deep">读完之后 · 几道小题 · 演示</p>
            <h1 className="font-heading truncate text-lg font-bold tracking-tight md:text-xl">{article.title}</h1>
          </div>
          <Button
            nativeButton={false}
            variant="ghost"
            className="h-10 shrink-0 rounded-xl px-3 text-sm text-muted-foreground hover:text-foreground"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            回今日
          </Button>
        </div>
      </header>

      <main className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:px-8 md:py-12">
        <Button
          nativeButton={false}
          variant="ghost"
          className="mb-8 h-10 gap-2 rounded-xl px-3 text-muted-foreground hover:text-foreground"
          render={<Link href={AUTH_ROUTES.learnArticle(articleId)} />}
        >
          <ArrowLeftIcon className="size-4" strokeWidth={1.5} aria-hidden />
          回阅读
        </Button>

        {isFinished ? (
          <section className="rounded-[1.75rem] border border-border bg-card p-8 md:p-10">
            <p className="text-sm tracking-wide text-brand-deep">这篇就到这</p>
            <h2 className="font-heading mt-3 text-3xl font-bold tracking-tight">先这样也很好</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              读过了，也轻轻练了一下。不想继续也没关系——明天还能再打开这篇。
            </p>
            <Button
              nativeButton={false}
              className="mt-10 h-12 w-full gap-2 rounded-2xl hover:bg-brand-deep sm:w-auto sm:px-8"
              render={<Link href={AUTH_ROUTES.dashboard} />}
            >
              <CheckCircleIcon className="size-4" strokeWidth={1.5} aria-hidden />
              先这样，回今日
            </Button>
          </section>
        ) : question ? (
          <>
            <div className="rounded-[1.75rem] bg-paper px-6 py-5 md:px-8">
              <p className="text-base leading-relaxed text-foreground/90">{article.practiceIntro}</p>
              <p className="mt-2 text-sm text-muted-foreground">不想练也可以跳过。</p>
            </div>

            <QuestionCard question={question} index={index} total={total} selected={selected} onSelect={setSelected} />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                nativeButton={false}
                variant="ghost"
                className="h-11 rounded-xl px-4 text-muted-foreground hover:text-foreground"
                render={<Link href={AUTH_ROUTES.dashboard} />}
              >
                跳过，回今日
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl px-7 hover:bg-brand-deep"
                disabled={selected == null}
                onClick={goNext}
              >
                {isLast ? '完成' : '下一题'}
              </Button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: LearnPracticeQuestion;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <section className="mt-8 rounded-[1.75rem] border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="tracking-wide text-brand-deep">{question.kind === 'vocab' ? '文中的词' : '理解确认'}</span>
        <span className="text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>

      {question.kind === 'vocab' ? (
        <>
          <h2 className="font-heading mt-5 text-3xl font-bold tracking-tight">{question.word}</h2>
          <p className="mt-2 text-muted-foreground">{question.hint}</p>
          <p className="mt-1 text-sm text-muted-foreground/80">{question.quote}</p>
        </>
      ) : (
        <h2 className="font-heading mt-5 text-2xl font-bold tracking-tight md:text-3xl">{question.prompt}</h2>
      )}

      <div
        className={cn('mt-6 gap-3', question.kind === 'vocab' ? 'grid sm:grid-cols-2' : 'flex flex-col')}
        role="listbox"
        aria-label="选项"
      >
        {question.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={cn(
                'rounded-xl border px-4 py-3.5 text-left text-sm leading-relaxed transition-colors duration-300 ease-out-soft',
                isSelected
                  ? 'border-brand-deep/30 bg-accent text-accent-foreground'
                  : 'border-transparent bg-muted/60 text-foreground hover:bg-muted',
              )}
              onClick={() => onSelect(optionIndex)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
