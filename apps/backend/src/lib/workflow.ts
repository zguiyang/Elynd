import { eq } from 'drizzle-orm';

import { readingWork as readingWorkTable } from '@gloaming/db';
import type { WorkflowStep, WorkStatus } from '@gloaming/shared/api/works';

import { db } from '@/db';

const STEP_RUNNING_STATUS: Record<WorkflowStep, WorkStatus> = {
  parse: 'processing',
  metadata: 'metadata',
  tts: 'tts',
};

/** Idle wait statuses that may still claim the next step (manual pipeline). */
const STEP_IDLE_CLAIM_STATUS: Partial<Record<WorkflowStep, WorkStatus>> = {
  parse: 'uploaded',
  metadata: 'parsed',
};

export function stepRunningStatus(step: WorkflowStep): WorkStatus {
  return STEP_RUNNING_STATUS[step];
}

/**
 * Claim the workflow step before running its job: the work must currently be
 * in this step's running status, its idle wait status (manual next), or failed
 * on exactly this step (retry self-heal). Returns false when the work is
 * elsewhere, in which case the caller should no-op.
 */
export async function claimWorkflowStep(workId: string, step: WorkflowStep): Promise<boolean> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    return false;
  }
  const running = STEP_RUNNING_STATUS[step];
  const idle = STEP_IDLE_CLAIM_STATUS[step];
  const failedHere = work.status === 'failed' && work.originMeta.failedStep === step;
  if (work.status !== running && work.status !== idle && !failedHere) {
    return false;
  }
  await db.update(readingWorkTable).set({ status: running }).where(eq(readingWorkTable.id, workId));
  return true;
}

/** Record a step failure: status → failed + failedStep/lastError/failedAt. */
export async function failWorkflowStep(workId: string, step: WorkflowStep, error: unknown): Promise<void> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  await db
    .update(readingWorkTable)
    .set({
      status: 'failed',
      originMeta: {
        ...work.originMeta,
        failedStep: step,
        lastError: message,
        failedAt: new Date().toISOString(),
      },
    })
    .where(eq(readingWorkTable.id, workId));
}

/** Complete the step: move to the next status and clear failure residue. */
export async function completeWorkflowStep(
  workId: string,
  nextStatus: WorkStatus,
  metaPatch?: Record<string, unknown>,
): Promise<void> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    return;
  }
  const originMeta: Record<string, unknown> = {
    ...work.originMeta,
    failedStep: undefined,
    lastError: undefined,
    failedAt: undefined,
    ...metaPatch,
  };
  await db.update(readingWorkTable).set({ status: nextStatus, originMeta }).where(eq(readingWorkTable.id, workId));
}
