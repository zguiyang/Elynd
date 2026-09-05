import { rootLogger } from '@/lib/logger';
import { claimWorkflowStep, failWorkflowStep } from '@/lib/workflow';
import { enrichWorkMetadata } from '@/modules/metadata-enrich/service';

export const JOB_METADATA_ENRICH = 'metadata-enrich';

export type MetadataEnrichJobData = {
  workId: string;
  retryJobToken: string;
};

const enrichJobLogger = rootLogger.child({ module: 'MetadataEnrichJob' });

/**
 * AI backfill job (step `metadata`, attempts: 2, at-least-once). Failure
 * surfaces as `failed` + `failedStep: metadata`; the BullMQ retry re-claims the
 * step (self-heal). The model-not-configured case degrades inside the service
 * and completes the step without AI.
 */
export async function processMetadataEnrich(data: MetadataEnrichJobData): Promise<{ ok: true; workId: string }> {
  if (!(await claimWorkflowStep(data.workId, 'metadata', data.retryJobToken))) {
    return { ok: true, workId: data.workId };
  }
  try {
    await enrichWorkMetadata(data.workId, data.retryJobToken);
  } catch (error) {
    enrichJobLogger.error({ err: error, workId: data.workId }, 'Metadata enrich failed');
    await failWorkflowStep(data.workId, 'metadata', data.retryJobToken, error);
    throw error;
  }
  return { ok: true, workId: data.workId };
}
