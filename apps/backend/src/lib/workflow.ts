import { and, eq, or, sql } from 'drizzle-orm';

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
  const running = STEP_RUNNING_STATUS[step];
  const idle = STEP_IDLE_CLAIM_STATUS[step];
  const eligible = [eq(readingWorkTable.status, running)];
  if (idle) {
    eligible.push(eq(readingWorkTable.status, idle));
  }
  eligible.push(
    and(eq(readingWorkTable.status, 'failed'), sql`${readingWorkTable.originMeta}->>'failedStep' = ${step}`)!,
  );

  const [claimed] = await db
    .update(readingWorkTable)
    .set({ status: running })
    .where(and(eq(readingWorkTable.id, workId), or(...eligible)))
    .returning({ id: readingWorkTable.id });
  return Boolean(claimed);
}

/** Record a step failure: status → failed + failedStep/lastError/failedAt. */
export async function failWorkflowStep(workId: string, step: WorkflowStep, error: unknown): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error);
  const failedAt = new Date().toISOString();
  const [failed] = await db
    .update(readingWorkTable)
    .set({
      status: 'failed',
      originMeta: sql`(${readingWorkTable.originMeta} - 'metadataAt' - 'metadataEnrichGaps' - 'metadataEnrichError') || ${JSON.stringify({ failedStep: step, lastError: message, failedAt })}::jsonb`,
    })
    .where(and(eq(readingWorkTable.id, workId), eq(readingWorkTable.status, STEP_RUNNING_STATUS[step])))
    .returning({ id: readingWorkTable.id });
  return Boolean(failed);
}

/** Complete the step: move to the next status and clear failure residue. */
export async function completeWorkflowStep(
  workId: string,
  nextStatus: WorkStatus,
  metaPatch?: Record<string, unknown>,
  expectedStatus?: WorkStatus | WorkStatus[],
): Promise<boolean> {
  const statuses = expectedStatus
    ? Array.isArray(expectedStatus)
      ? expectedStatus
      : [expectedStatus]
    : ['processing', 'metadata', 'tts' as const];
  const patch = JSON.stringify(metaPatch ?? {});
  const [completed] = await db
    .update(readingWorkTable)
    .set({
      status: nextStatus,
      originMeta: sql`(${readingWorkTable.originMeta} - 'failedStep' - 'lastError' - 'failedAt') || ${patch}::jsonb`,
    })
    .where(and(eq(readingWorkTable.id, workId), or(...statuses.map((status) => eq(readingWorkTable.status, status)))))
    .returning({ id: readingWorkTable.id });
  return Boolean(completed);
}
