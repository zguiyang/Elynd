import { REVIEW_DAILY_CAP } from '@elynd/shared/api/review';

export type ReviewPickCandidate = {
  id: string;
  articleId: string;
  sortOrder: number;
  lastAppearedOn: string | null;
};

function comparePickCandidates(a: ReviewPickCandidate, b: ReviewPickCandidate): number {
  const aNever = a.lastAppearedOn == null;
  const bNever = b.lastAppearedOn == null;
  if (aNever !== bNever) {
    return aNever ? -1 : 1;
  }
  if (a.lastAppearedOn != null && b.lastAppearedOn != null && a.lastAppearedOn !== b.lastAppearedOn) {
    return a.lastAppearedOn < b.lastAppearedOn ? -1 : 1;
  }
  if (a.articleId !== b.articleId) {
    return a.articleId < b.articleId ? -1 : 1;
  }
  return a.sortOrder - b.sortOrder;
}

/** Naive daily draw: unseen first, then oldest appearance, then article + sortOrder. */
export function pickDailyReviewItems<T extends ReviewPickCandidate>(candidates: T[], cap = REVIEW_DAILY_CAP): T[] {
  return [...candidates].sort(comparePickCandidates).slice(0, cap);
}
