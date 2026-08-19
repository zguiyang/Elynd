import { REVIEW_TIME_ZONE } from '@elynd/shared/api/review';

import { materializeDailyReview } from '@/modules/review/service';

export const JOB_REVIEW_MATERIALIZE = 'review.materialize';
export const REVIEW_MATERIALIZE_SCHEDULER_ID = 'review-materialize-daily';
export const REVIEW_MATERIALIZE_CRON = '0 0 2 * * *';
export const REVIEW_MATERIALIZE_TZ = REVIEW_TIME_ZONE;

export type ReviewMaterializeJobData = {
  mode: 'cron' | 'manual';
};

export async function processReviewMaterialize(
  data: ReviewMaterializeJobData,
): Promise<{ date: string; users: number }> {
  const mode = data.mode === 'manual' ? 'manual' : 'cron';
  return materializeDailyReview({ mode });
}
