import { and, eq, or, sql } from 'drizzle-orm';

import { readingWork as readingWorkTable } from '@gloaming/db';
import type { WorkflowStep, WorkStatus } from '@gloaming/shared';

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

function workflowTokenMatch(retryJobToken: string) {
  return sql`${readingWorkTable.originMeta}->>'retryJobToken' = ${retryJobToken}`;
}

function workflowClaimMatch(retryJobToken: string, step: WorkflowStep) {
  return and(
    sql`${readingWorkTable.originMeta}->>'workflowClaimToken' = ${retryJobToken}`,
    sql`${readingWorkTable.originMeta}->>'workflowClaimStep' = ${step}`,
  );
}

/** Conditional ownership predicate for a worker that has already claimed a step. */
export function workflowClaimWhere(workId: string, step: WorkflowStep, retryJobToken: string) {
  return and(
    eq(readingWorkTable.id, workId),
    eq(readingWorkTable.status, STEP_RUNNING_STATUS[step]),
    workflowTokenMatch(retryJobToken),
    workflowClaimMatch(retryJobToken, step),
  );
}

/**
 * Claim the workflow step before running its job: the work must currently be
 * in this step's running status but not already claimed, its idle wait status
 * (manual next), or failed on exactly this step (retry self-heal). The queued
 * retry token is the execution identity, so duplicate deliveries cannot claim
 * the same row twice.
 */
export async function claimWorkflowStep(workId: string, step: WorkflowStep, retryJobToken: string): Promise<boolean> {
  if (!retryJobToken) {
    return false;
  }
  const running = STEP_RUNNING_STATUS[step];
  const idle = STEP_IDLE_CLAIM_STATUS[step];
  const unclaimed = sql`coalesce(${readingWorkTable.originMeta}->>'workflowClaimToken', '') = ''`;
  const eligible = [and(eq(readingWorkTable.status, running), workflowTokenMatch(retryJobToken), unclaimed)!];
  if (idle) {
    eligible.push(and(eq(readingWorkTable.status, idle), workflowTokenMatch(retryJobToken), unclaimed)!);
  }
  eligible.push(
    and(
      eq(readingWorkTable.status, 'failed'),
      sql`${readingWorkTable.originMeta}->>'failedStep' = ${step}`,
      workflowTokenMatch(retryJobToken),
      unclaimed,
    )!,
  );

  const [claimed] = await db
    .update(readingWorkTable)
    .set({
      status: running,
      originMeta: sql`${readingWorkTable.originMeta} || ${JSON.stringify({ workflowClaimToken: retryJobToken, workflowClaimStep: step })}::jsonb`,
    })
    .where(and(eq(readingWorkTable.id, workId), or(...eligible)))
    .returning({ id: readingWorkTable.id });
  return Boolean(claimed);
}

/** Record a step failure: status → failed + failedStep/lastError/failedAt. */
export async function failWorkflowStep(
  workId: string,
  step: WorkflowStep,
  retryJobToken: string,
  error: unknown,
): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error);
  const failedAt = new Date().toISOString();
  const [failed] = await db
    .update(readingWorkTable)
    .set({
      status: 'failed',
      originMeta: sql`(${readingWorkTable.originMeta} - 'metadataAt' - 'metadataEnrichGaps' - 'metadataEnrichError' - 'workflowClaimToken' - 'workflowClaimStep') || ${JSON.stringify({ failedStep: step, lastError: message, failedAt })}::jsonb`,
    })
    .where(workflowClaimWhere(workId, step, retryJobToken))
    .returning({ id: readingWorkTable.id });
  return Boolean(failed);
}

/** Convert a post-claim enqueue failure into a retryable workflow failure. */
export async function failWorkflowEnqueue(
  workId: string,
  step: WorkflowStep,
  retryJobToken: string,
  currentStatus: WorkStatus,
  error: unknown,
): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error);
  const failedAt = new Date().toISOString();
  const [failed] = await db
    .update(readingWorkTable)
    .set({
      status: 'failed',
      originMeta: sql`(${readingWorkTable.originMeta} - 'metadataAt' - 'metadataEnrichGaps' - 'metadataEnrichError' - 'retryJobToken' - 'workflowClaimToken' - 'workflowClaimStep') || ${JSON.stringify({ failedStep: step, lastError: message, failedAt })}::jsonb`,
    })
    .where(
      and(
        eq(readingWorkTable.id, workId),
        eq(readingWorkTable.status, currentStatus),
        workflowTokenMatch(retryJobToken),
      ),
    )
    .returning({ id: readingWorkTable.id });
  return Boolean(failed);
}

/** Complete the step: move to the next status and clear failure residue. */
export async function completeWorkflowStep(
  workId: string,
  nextStatus: WorkStatus,
  metaPatch?: Record<string, unknown>,
  expectedStatus?: WorkStatus | WorkStatus[],
  retryJobToken?: string,
  claimStep?: WorkflowStep,
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
      originMeta: sql`(${readingWorkTable.originMeta} - 'failedStep' - 'lastError' - 'failedAt' - 'workflowClaimToken' - 'workflowClaimStep') || ${patch}::jsonb`,
    })
    .where(
      retryJobToken && claimStep
        ? and(
            eq(readingWorkTable.id, workId),
            or(...statuses.map((status) => eq(readingWorkTable.status, status))),
            workflowTokenMatch(retryJobToken),
            workflowClaimMatch(retryJobToken, claimStep),
          )
        : and(eq(readingWorkTable.id, workId), or(...statuses.map((status) => eq(readingWorkTable.status, status)))),
    )
    .returning({ id: readingWorkTable.id });
  return Boolean(completed);
}

/** Rotate the execution identity between sequential jobs in one workflow step. */
export async function rotateWorkflowJobToken(
  workId: string,
  claimStep: WorkflowStep,
  currentStatus: WorkStatus,
  currentToken: string,
  nextToken: string,
  nextStatus: WorkStatus,
): Promise<boolean> {
  const [rotated] = await db
    .update(readingWorkTable)
    .set({
      status: nextStatus,
      originMeta: sql`(${readingWorkTable.originMeta} - 'workflowClaimToken' - 'workflowClaimStep') || ${JSON.stringify({ retryJobToken: nextToken })}::jsonb`,
    })
    .where(
      and(
        eq(readingWorkTable.id, workId),
        eq(readingWorkTable.status, currentStatus),
        workflowTokenMatch(currentToken),
        workflowClaimMatch(currentToken, claimStep),
      ),
    )
    .returning({ id: readingWorkTable.id });
  return Boolean(rotated);
}
