'use client';

import { useState, useSyncExternalStore } from 'react';

import { AUTH_ROUTES } from '@/constants';
import { ReviewFinish } from '@/features/review/review-finish';
import {
  checkLine,
  dailyGatePayload,
  isSameDayGate,
  REVIEW_DAILY_CAP,
  REVIEW_DAILY_GATE_KEY,
  REVIEW_STUB,
  type ReviewFinishVariant,
  type ReviewMiss,
  reviewQueue,
  todayIso,
} from '@/features/review/review-model';
import { ReviewSession } from '@/features/review/review-session';

type ReviewStatus = 'empty' | 'prompt' | 'check' | 'complete' | 'capped' | 'early';

function readReviewGate(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return isSameDayGate(sessionStorage.getItem(REVIEW_DAILY_GATE_KEY), todayIso());
}

function subscribeReviewGate(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

function writeReviewGate() {
  sessionStorage.setItem(REVIEW_DAILY_GATE_KEY, dailyGatePayload(todayIso()));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Review — re-meet sentences from a recent article. Manuscript layout, stub queue.
 */
export function ReviewPage() {
  const queue = reviewQueue(REVIEW_STUB.items);
  const total = queue.length;
  const sourceHref = AUTH_ROUTES.learnArticle(REVIEW_STUB.articleId);
  const isCappedToday = useSyncExternalStore(subscribeReviewGate, readReviewGate, () => false);

  const [status, setStatus] = useState<ReviewStatus>(() => (total === 0 ? 'empty' : 'prompt'));
  const [itemIndex, setItemIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [misses, setMisses] = useState<ReviewMiss[]>([]);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const item = queue[itemIndex];
  const screen = resolveReviewScreen(status, isCappedToday, total);
  const finishVariant = finishVariantFor(screen, total);

  function confirm() {
    if (!item || selectedIndex == null || status !== 'prompt') {
      return;
    }
    const result = checkLine(item, selectedIndex);
    if (!result.isHit) {
      setMisses((current) => [...current, { item, selectedIndex }]);
    }
    setHint(result.line);
    setStatus('check');
  }

  function goNext() {
    if (itemIndex >= total - 1) {
      writeReviewGate();
      setStatus('complete');
      setIsSourceOpen(false);
      return;
    }
    setItemIndex((current) => current + 1);
    setSelectedIndex(null);
    setHint(null);
    setStatus('prompt');
  }

  function goEarly() {
    setIsSourceOpen(false);
    setStatus('early');
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-2xl">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">再碰一次</h1>
        {item && (screen === 'prompt' || screen === 'check') ? (
          <p className="text-sm tabular-nums text-muted-foreground">
            {itemIndex + 1} / {total}
          </p>
        ) : null}
      </header>
      <p className="mt-3 text-xs text-muted-foreground">示例内容</p>

      {finishVariant ? (
        <ReviewFinish
          variant={finishVariant}
          articleTitle={REVIEW_STUB.articleTitle}
          sourceHref={sourceHref}
          misses={misses}
          total={total}
        />
      ) : item ? (
        <ReviewSession
          articleTitle={REVIEW_STUB.articleTitle}
          paragraphs={REVIEW_STUB.paragraphs}
          item={item}
          itemIndex={itemIndex}
          total={total}
          selectedIndex={selectedIndex}
          isChecked={screen === 'check'}
          isSourceOpen={isSourceOpen}
          hint={hint}
          onSelect={setSelectedIndex}
          onConfirm={confirm}
          onNext={goNext}
          onEarly={goEarly}
          onSourceOpenChange={setIsSourceOpen}
        />
      ) : (
        <ReviewFinish
          variant="empty"
          articleTitle={REVIEW_STUB.articleTitle}
          sourceHref={sourceHref}
          misses={[]}
          total={0}
        />
      )}
    </div>
  );
}

function resolveReviewScreen(status: ReviewStatus, isCappedToday: boolean, total: number): ReviewStatus {
  if (total === 0) {
    return 'empty';
  }
  if (status === 'complete' || status === 'early' || status === 'check') {
    return status;
  }
  if (isCappedToday) {
    return 'capped';
  }
  return status;
}

function finishVariantFor(status: ReviewStatus, total: number): ReviewFinishVariant | null {
  if (status === 'empty' || status === 'early' || status === 'capped') {
    return status;
  }
  if (status === 'complete') {
    return total < REVIEW_DAILY_CAP ? 'exhaust' : 'complete';
  }
  return null;
}
