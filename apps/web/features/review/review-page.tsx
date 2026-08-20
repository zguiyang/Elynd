'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  type LearnerReviewQueueItem,
  type ReviewSessionResult,
  type ReviewTodayData,
} from '@gloaming/shared/api/review';

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';
import {
  answerReviewToday,
  formatReviewApiError,
  getReviewToday,
  leaveReviewToday,
  reviewQueryKey,
} from '@/features/review/review-api';
import { ReviewFinish } from '@/features/review/review-finish';
import { type ReviewFinishVariant, type ReviewMiss } from '@/features/review/review-model';
import { ReviewSession } from '@/features/review/review-session';
import { ReviewSummary } from '@/features/review/review-summary';

type ReviewPlayStatus = 'prompt' | 'check' | 'early';

/**
 * Review — re-meet sentences from completed articles. Server-backed daily queue.
 */
export function ReviewPage() {
  const todayQuery = useQuery({
    queryKey: reviewQueryKey.today,
    queryFn: ({ signal }) => getReviewToday({ signal }),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (todayQuery.isPending) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  if (todayQuery.isError || !todayQuery.data) {
    return (
      <Empty className="border border-dashed border-border bg-card/50 py-16">
        <EmptyHeader>
          <EmptyTitle>无法加载今日复习</EmptyTitle>
          <EmptyDescription>{formatReviewApiError(todayQuery.error ?? new Error('缺失'))}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <ReviewTodayBody data={todayQuery.data} />;
}

function ReviewTodayBody({ data }: { data: ReviewTodayData }) {
  const items = data.items;
  const unanswered = items.findIndex((row) => row.selectedIndex == null);
  const [status, setStatus] = useState<ReviewPlayStatus>('prompt');
  const [itemIndex, setItemIndex] = useState(unanswered < 0 ? 0 : unanswered);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealedCorrectIndex, setRevealedCorrectIndex] = useState<number | null>(null);
  const [misses, setMisses] = useState<ReviewMiss[]>([]);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<ReviewSessionResult | null>(null);
  const [isShowingSummary, setIsShowingSummary] = useState(data.outcome === 'completed');

  const total = items.length;
  const item = items[itemIndex];
  const summaryResult = pendingResult ?? (data.outcome === 'completed' ? data.result : null);
  const finishVariant = finishVariantFor(data.queueStatus, status, isShowingSummary);

  const answerMutation = useMutation({
    mutationFn: (input: { itemId: string; selectedIndex: number; item: LearnerReviewQueueItem }) =>
      answerReviewToday({ itemId: input.itemId, selectedIndex: input.selectedIndex }),
    onSuccess: (result, input) => {
      setRevealedCorrectIndex(result.correctIndex);
      setHint(result.hint);
      if (result.result) {
        setPendingResult(result.result);
      }
      if (!result.isHit) {
        setMisses((current) => [...current, { item: toReviewItem(input.item), selectedIndex: input.selectedIndex }]);
      }
      setStatus('check');
    },
    onError: (error) => {
      toast.error(formatReviewApiError(error));
    },
  });

  const leaveMutation = useMutation({
    mutationFn: leaveReviewToday,
    onSuccess: () => {
      setIsSourceOpen(false);
      setStatus('early');
    },
    onError: (error) => {
      toast.error(formatReviewApiError(error));
    },
  });

  function confirm() {
    if (!item || selectedIndex == null || status !== 'prompt' || answerMutation.isPending) {
      return;
    }
    answerMutation.mutate({ itemId: item.id, selectedIndex, item });
  }

  function goNext() {
    if (itemIndex >= total - 1) {
      setIsSourceOpen(false);
      setIsShowingSummary(true);
      return;
    }
    setItemIndex((current) => current + 1);
    setSelectedIndex(null);
    setRevealedCorrectIndex(null);
    setHint(null);
    setIsSourceOpen(false);
    setStatus('prompt');
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-2xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">再碰一次</h1>
        {item && finishVariant == null && !isShowingSummary ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            {itemIndex + 1} / {total}
          </p>
        ) : null}
      </header>

      {finishVariant ? (
        <ReviewFinish
          variant={finishVariant}
          articleTitle={finishArticleTitle(item, misses, items)}
          sourceHref={AUTH_ROUTES.learnArticle(finishArticleId(item, misses, items))}
          misses={misses}
          total={total}
        />
      ) : isShowingSummary && summaryResult ? (
        <ReviewSummary date={data.date} result={summaryResult} />
      ) : item ? (
        <ReviewSession
          articleId={item.articleId}
          articleTitle={item.articleTitle}
          paragraphs={item.paragraphs}
          item={toReviewItem(item)}
          itemIndex={itemIndex}
          total={total}
          isLast={itemIndex >= total - 1}
          selectedIndex={selectedIndex}
          correctIndex={revealedCorrectIndex}
          isChecked={status === 'check'}
          isSourceOpen={isSourceOpen}
          hint={hint}
          isSubmitting={answerMutation.isPending}
          isLeaving={leaveMutation.isPending}
          onSelect={setSelectedIndex}
          onConfirm={confirm}
          onNext={goNext}
          onEarly={() => leaveMutation.mutate()}
          onSourceOpenChange={setIsSourceOpen}
        />
      ) : (
        <ReviewFinish variant="empty" articleTitle="" sourceHref={AUTH_ROUTES.library} misses={[]} total={0} />
      )}
    </div>
  );
}

function toReviewItem(item: LearnerReviewQueueItem) {
  return {
    id: item.id,
    kind: item.kind,
    sentence: item.sentence,
    focus: item.focus,
    options: item.options,
    hintZh: item.hintZh,
  };
}

function finishVariantFor(
  queueStatus: ReviewTodayData['queueStatus'],
  status: ReviewPlayStatus,
  isShowingSummary: boolean,
): ReviewFinishVariant | null {
  if (status === 'early') {
    return 'early';
  }
  if (isShowingSummary) {
    return null;
  }
  if (queueStatus === 'need_completion') {
    return 'need_completion';
  }
  if (queueStatus === 'empty') {
    return 'empty';
  }
  return null;
}

function finishArticleTitle(
  item: LearnerReviewQueueItem | undefined,
  misses: ReviewMiss[],
  items: LearnerReviewQueueItem[],
): string {
  const missId = misses[0]?.item.id;
  const fromMiss = missId ? items.find((row) => row.id === missId) : undefined;
  return fromMiss?.articleTitle ?? item?.articleTitle ?? items[0]?.articleTitle ?? '';
}

function finishArticleId(
  item: LearnerReviewQueueItem | undefined,
  misses: ReviewMiss[],
  items: LearnerReviewQueueItem[],
): string {
  const missId = misses[0]?.item.id;
  const fromMiss = missId ? items.find((row) => row.id === missId) : undefined;
  return fromMiss?.articleId ?? item?.articleId ?? items[0]?.articleId ?? '';
}
