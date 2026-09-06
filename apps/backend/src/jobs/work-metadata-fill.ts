import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { readingWork as readingWorkTable } from '@gloaming/db';

import { db } from '@/db';
import { JOB_METADATA_ENRICH } from '@/jobs/metadata-enrich';
import { rootLogger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { claimWorkflowStep, failWorkflowEnqueue, failWorkflowStep, rotateWorkflowJobToken } from '@/lib/workflow';
import { resetMetadataAiOutputs } from '@/modules/ingest-reset/service';
import { fillWorkMetadata } from '@/modules/metadata-fill/service';

export const JOB_METADATA_FILL = 'metadata-fill';

export type WorkMetadataFillJobData = {
  workId: string;
  retryJobToken: string;
};

const fillJobLogger = rootLogger.child({ module: 'MetadataFillJob' });

/**
 * Rule-layer metadata fill (step `metadata`). Failures surface as `failed` +
 * `failedStep: metadata` and rethrow so BullMQ can retry (attempts: 2); the
 * retry self-heals through the workflow claim. Success chains into AI
 * enrichment, which short-circuits when nothing needs AI.
 */
export async function processWorkMetadataFill(
  data: WorkMetadataFillJobData,
  attemptToken = randomUUID(),
): Promise<{ ok: true; workId: string }> {
  if (!(await claimWorkflowStep(data.workId, 'metadata', data.retryJobToken, attemptToken))) {
    return { ok: true, workId: data.workId };
  }
  try {
    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, data.workId)).limit(1);
    if (work) {
      await resetMetadataAiOutputs(work);
    }
    await fillWorkMetadata(data.workId);
  } catch (error) {
    fillJobLogger.error({ err: error, workId: data.workId }, 'Metadata fill failed');
    await failWorkflowStep(data.workId, 'metadata', data.retryJobToken, attemptToken, error);
    throw error;
  }
  const retryJobToken = randomUUID();
  const enrichEnqueueAttemptToken = randomUUID();
  if (
    !(await rotateWorkflowJobToken(
      data.workId,
      'metadata',
      'metadata',
      data.retryJobToken,
      attemptToken,
      retryJobToken,
      enrichEnqueueAttemptToken,
      'metadata',
      'metadata',
    ))
  ) {
    return { ok: true, workId: data.workId };
  }
  try {
    await enqueue(
      JOB_METADATA_ENRICH,
      { workId: data.workId, retryJobToken },
      { attempts: 2, jobId: `${JOB_METADATA_ENRICH}:${data.workId}:${retryJobToken}` },
    );
  } catch (error) {
    await failWorkflowEnqueue(data.workId, 'metadata', retryJobToken, 'metadata', enrichEnqueueAttemptToken, error);
    throw error;
  }
  return { ok: true, workId: data.workId };
}
