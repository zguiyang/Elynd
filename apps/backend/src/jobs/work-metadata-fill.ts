import { JOB_METADATA_ENRICH } from '@/jobs/metadata-enrich';
import { rootLogger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { claimWorkflowStep, failWorkflowStep } from '@/lib/workflow';
import { fillWorkMetadata } from '@/modules/metadata-fill/service';

export const JOB_METADATA_FILL = 'metadata-fill';

export type WorkMetadataFillJobData = {
  workId: string;
};

const fillJobLogger = rootLogger.child({ module: 'MetadataFillJob' });

/**
 * Rule-layer metadata fill (step `metadata`). Failures surface as `failed` +
 * `failedStep: metadata` and rethrow so BullMQ can retry (attempts: 2); the
 * retry self-heals through the workflow claim. Success chains into AI
 * enrichment, which short-circuits when nothing needs AI.
 */
export async function processWorkMetadataFill(data: WorkMetadataFillJobData): Promise<{ ok: true; workId: string }> {
  if (!(await claimWorkflowStep(data.workId, 'metadata'))) {
    return { ok: true, workId: data.workId };
  }
  try {
    await fillWorkMetadata(data.workId);
  } catch (error) {
    fillJobLogger.error({ err: error, workId: data.workId }, 'Metadata fill failed');
    await failWorkflowStep(data.workId, 'metadata', error);
    throw error;
  }
  await enqueue(JOB_METADATA_ENRICH, { workId: data.workId }, { attempts: 2 });
  return { ok: true, workId: data.workId };
}
