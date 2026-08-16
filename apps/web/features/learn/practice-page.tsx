'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, BookOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import type {
  LearnerPracticeItem,
  LearnPracticeData,
  PracticeAttempt,
  PracticeAttemptResult,
  UpdatePracticeAttemptBody,
} from '@elynd/shared/api/learn';
import { practiceOptionLetter } from '@elynd/shared/api/learn';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import {
  formatLearnApiError,
  getLearnPractice,
  learnQueryKey,
  requestPracticeFeedback,
  startLearnPracticeAttempt,
  updateLearnPracticeAttempt,
} from '@/features/learn/learn-api';
import { PracticeSummary } from '@/features/learn/practice-summary';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

type LearnPracticePageProps = {
  articleId: string;
};

type SummaryPhase =
  | { status: 'preparing'; result: PracticeAttemptResult; attemptId: string }
  | { status: 'ready'; result: PracticeAttemptResult; advice: string | null };

/**
 * Practice — curated items for the same article, one question at a time.
 */
export function LearnPracticePage({ articleId }: LearnPracticePageProps) {
  const [summaryPhase, setSummaryPhase] = useState<SummaryPhase | null>(null);

  const practiceQuery = useQuery({
    queryKey: learnQueryKey.practice(articleId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const data = await getLearnPractice(articleId, { signal });
      if (data.items.length === 0) {
        return data;
      }
      // Server only returns in-progress attempts; start a new session when none.
      if (data.attempt?.status === 'in_progress') {
        return data;
      }
      const attempt = await startLearnPracticeAttempt(articleId);
      return { ...data, attempt };
    },
  });

  const preparingAttemptId = summaryPhase?.status === 'preparing' ? summaryPhase.attemptId : null;
  const preparingResult = summaryPhase?.status === 'preparing' ? summaryPhase.result : null;

  useEffect(() => {
    if (preparingAttemptId == null || preparingResult == null) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const { advice } = await requestPracticeFeedback(articleId, preparingAttemptId, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSummaryPhase({ status: 'ready', result: preparingResult, advice });
        }
      } catch {
        if (!controller.signal.aborted) {
          setSummaryPhase({ status: 'ready', result: preparingResult, advice: null });
        }
      }
    })();
    return () => controller.abort();
  }, [articleId, preparingAttemptId, preparingResult]);

  const isNotFound = practiceQuery.error instanceof ApiRequestError && practiceQuery.error.status === 404;

  if (practiceQuery.isPending) {
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
            <EmptyTitle>找不到这篇练习</EmptyTitle>
            <EmptyDescription>回今日重新打开一篇阅读即可。</EmptyDescription>
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

  if (practiceQuery.isError) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>暂时无法加载练习</EmptyTitle>
            <EmptyDescription>{formatLearnApiError(practiceQuery.error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const practice = practiceQuery.data;
  if (!practice) {
    return null;
  }

  if (practice.items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <Empty className="border border-dashed border-border bg-card/50 py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>这篇暂无练习</EmptyTitle>
            <EmptyDescription>有小题时再来这里。</EmptyDescription>
          </EmptyHeader>
          <Button
            nativeButton={false}
            className="mt-6 h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.learnArticle(articleId)} />}
          >
            回阅读
          </Button>
        </Empty>
      </div>
    );
  }

  if (summaryPhase?.status === 'preparing') {
    return (
      <PracticeShell articleId={articleId} title={practice.articleTitle}>
        <div className="flex min-h-[min(50dvh,24rem)] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">练习总结</p>
          <p className="font-heading text-2xl font-bold tracking-tight">正在生成学习建议…</p>
          <p className="max-w-sm text-sm text-muted-foreground">稍等片刻，对照与建议马上就来。</p>
        </div>
      </PracticeShell>
    );
  }

  if (summaryPhase?.status === 'ready') {
    return (
      <PracticeShell articleId={articleId} title={practice.articleTitle}>
        <PracticeSummary result={summaryPhase.result} advice={summaryPhase.advice} />
      </PracticeShell>
    );
  }

  if (!practice.attempt || practice.attempt.status !== 'in_progress') {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <PracticeSession
      key={practice.attempt.id}
      articleId={articleId}
      practice={practice}
      attempt={practice.attempt}
      onCompleted={(result, attemptId) => setSummaryPhase({ status: 'preparing', result, attemptId })}
    />
  );
}

function PracticeShell({ articleId, title, children }: { articleId: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="border-b border-border/80 bg-sidebar">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 md:px-8">
          <div className="min-w-0">
            <p className="text-sm tracking-wide text-brand-deep">读完之后 · 几道小题</p>
            <h1 className="font-heading truncate text-lg font-bold tracking-tight md:text-xl">{title}</h1>
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
        {children}
      </main>
    </div>
  );
}

function PracticeSession({
  articleId,
  practice,
  attempt,
  onCompleted,
}: {
  articleId: string;
  practice: LearnPracticeData;
  attempt: PracticeAttempt;
  onCompleted: (result: PracticeAttemptResult, attemptId: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localIndex, setLocalIndex] = useState<number | null>(null);
  const [pickedOption, setPickedOption] = useState<number | null>(null);
  const [pickedQuestionId, setPickedQuestionId] = useState<string | null>(null);

  const questions = practice.items;
  const total = questions.length;
  const index = localIndex ?? attempt.currentIndex;
  const question = questions[index];
  const isLast = index >= total - 1;
  const questionId = question?.id;
  const restoredOption =
    questionId == null
      ? null
      : (attempt.answers.find((answer) => answer.practiceItemId === questionId)?.selectedOptionIndex ?? null);
  const selected = pickedQuestionId === questionId ? pickedOption : restoredOption;
  const practiceIntro = `刚读过《${practice.articleTitle}》。下面几题只帮你确认理解，不是考试——不想练也可以跳过。`;

  const patchMutation = useMutation({
    mutationFn: (input: { attemptId: string; body: UpdatePracticeAttemptBody }) =>
      updateLearnPracticeAttempt(articleId, input.attemptId, input.body),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: learnQueryKey.today() });
      if (updated.status === 'in_progress') {
        queryClient.setQueryData(learnQueryKey.practice(articleId), (previous: LearnPracticeData | undefined) =>
          previous ? { ...previous, attempt: updated } : previous,
        );
        return;
      }
      // Clear finished attempt so the next visit starts a fresh in-progress session.
      queryClient.setQueryData(learnQueryKey.practice(articleId), (previous: LearnPracticeData | undefined) =>
        previous ? { ...previous, attempt: null } : previous,
      );
    },
  });

  function goNext() {
    if (selected == null || !question || attempt.status !== 'in_progress' || patchMutation.isPending) {
      return;
    }
    const nextIndex = isLast ? index : index + 1;
    patchMutation.mutate(
      {
        attemptId: attempt.id,
        body: {
          currentIndex: nextIndex,
          answers: [{ practiceItemId: question.id, selectedOptionIndex: selected }],
          ...(isLast ? { status: 'completed' as const } : {}),
        },
      },
      {
        onSuccess: (updated) => {
          if (isLast) {
            if (!updated.result) {
              return;
            }
            onCompleted(updated.result, updated.id);
            return;
          }
          setLocalIndex(nextIndex);
          setPickedQuestionId(null);
          setPickedOption(null);
        },
      },
    );
  }

  function skipPractice() {
    if (attempt.status !== 'in_progress' || patchMutation.isPending) {
      return;
    }
    patchMutation.mutate(
      { attemptId: attempt.id, body: { status: 'skipped' } },
      {
        onSuccess: () => {
          router.push(AUTH_ROUTES.dashboard);
        },
      },
    );
  }

  return (
    <PracticeShell articleId={articleId} title={practice.articleTitle}>
      <div className="rounded-[1.75rem] bg-paper px-6 py-5 md:px-8">
        <p className="text-base leading-relaxed text-foreground/90">{practiceIntro}</p>
      </div>

      {question ? (
        <>
          <QuestionCard
            question={question}
            index={index}
            total={total}
            selected={selected}
            onSelect={(optionIndex) => {
              if (!questionId) {
                return;
              }
              setPickedQuestionId(questionId);
              setPickedOption(optionIndex);
            }}
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-4 text-muted-foreground hover:text-foreground"
              disabled={patchMutation.isPending}
              onClick={skipPractice}
            >
              跳过，回今日
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl px-7 hover:bg-brand-deep"
              disabled={selected == null || patchMutation.isPending}
              onClick={goNext}
            >
              {isLast ? '完成' : '下一题'}
            </Button>
          </div>
        </>
      ) : null}
    </PracticeShell>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: LearnerPracticeItem;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  const options = question.payload.options;

  return (
    <section className="mt-8 rounded-[1.75rem] border border-border bg-card p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="tracking-wide text-brand-deep">{question.kind === 'vocab' ? '文中的词' : '理解确认'}</span>
        <span className="text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>

      {question.kind === 'vocab' && 'word' in question.payload ? (
        <>
          <h2 className="font-heading mt-5 text-3xl font-bold tracking-tight">{question.payload.word}</h2>
          <p className="mt-2 text-muted-foreground">{question.payload.hint}</p>
          <p className="mt-1 text-sm text-muted-foreground/80">{question.payload.quote}</p>
        </>
      ) : 'prompt' in question.payload ? (
        <h2 className="font-heading mt-5 text-2xl font-bold tracking-tight md:text-3xl">{question.payload.prompt}</h2>
      ) : null}

      <div
        className={cn('mt-6 gap-3', question.kind === 'vocab' ? 'grid sm:grid-cols-2' : 'flex flex-col')}
        role="listbox"
        aria-label="选项"
      >
        {options.map((option, optionIndex) => {
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
              <span className="mr-2 font-medium text-muted-foreground">{practiceOptionLetter(optionIndex)}.</span>
              {option}
            </button>
          );
        })}
      </div>
    </section>
  );
}
