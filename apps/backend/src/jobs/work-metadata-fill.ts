import { eq } from 'drizzle-orm';

import { readingWork as readingWorkTable } from '@gloaming/db';

import { db } from '@/db';
import { JOB_METADATA_ENRICH } from '@/jobs/metadata-enrich';
import { rootLogger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { fillWorkMetadata } from '@/modules/metadata-fill/service';

export const JOB_METADATA_FILL = 'metadata-fill';

export type WorkMetadataFillJobData = {
  workId: string;
};

const fillJobLogger = rootLogger.child({ module: 'MetadataFillJob' });

/**
 * Rule-layer metadata fill. Failures never fail the work (content is ready);
 * they are recorded in originMeta.lastError and the pipeline still moves on
 * to AI enrichment, which fills whatever rules missed.
 */
export async function processWorkMetadataFill(data: WorkMetadataFillJobData): Promise<{ ok: true; workId: string }> {
  try {
    await fillWorkMetadata(data.workId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fillJobLogger.error({ err: error, workId: data.workId }, 'Metadata fill failed');
    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, data.workId)).limit(1);
    if (work) {
      await db
        .update(readingWorkTable)
        .set({
          originMeta: {
            ...work.originMeta,
            lastError: message,
            failedAt: new Date().toISOString(),
          },
        })
        .where(eq(readingWorkTable.id, data.workId));
    }
  }
  // Enrichment runs regardless of fill outcome — it short-circuits itself
  // when no field needs AI (bounded retry, attempts: 2).
  await enqueue(JOB_METADATA_ENRICH, { workId: data.workId }, { attempts: 2 });
  return { ok: true, workId: data.workId };
}
