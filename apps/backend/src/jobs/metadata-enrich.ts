import { and, eq } from 'drizzle-orm';

import { readingWork as readingWorkTable } from '@gloaming/db';

import { db } from '@/db';
import { rootLogger } from '@/lib/logger';
import { enrichWorkMetadata } from '@/modules/metadata-enrich/service';

export const JOB_METADATA_ENRICH = 'metadata-enrich';

export type MetadataEnrichJobData = {
  workId: string;
};

const enrichJobLogger = rootLogger.child({ module: 'MetadataEnrichJob' });

/**
 * AI backfill job (attempts: 2, at-least-once). On failure the claim is
 * restored to `pending` so the retry can re-claim; the model-not-configured
 * case degrades to `skipped` inside the service and never reaches here.
 */
export async function processMetadataEnrich(data: MetadataEnrichJobData): Promise<{ ok: true; workId: string }> {
  try {
    await enrichWorkMetadata(data.workId);
  } catch (error) {
    enrichJobLogger.error({ err: error, workId: data.workId }, 'Metadata enrich failed');
    await db
      .update(readingWorkTable)
      .set({ metadataEnrichmentStatus: 'pending' })
      .where(and(eq(readingWorkTable.id, data.workId), eq(readingWorkTable.metadataEnrichmentStatus, 'running')));
    throw error;
  }
  return { ok: true, workId: data.workId };
}
