import { and, eq, inArray, or } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
  readingWorkCategory as readingWorkCategoryTable,
  readingWorkSource as readingWorkSourceTable,
  readingWorkTag as readingWorkTagTable,
} from '@gloaming/db';

import { db } from '@/db';
import { rootLogger } from '@/lib/logger';
import { workflowClaimWhere } from '@/lib/workflow';
import { deleteAudioAssetObjects } from '@/modules/content-assets/service';
import { deleteObject } from '@/modules/oss';

const ingestLogger = rootLogger.child({ module: 'IngestReset' });

type WorkRow = typeof readingWorkTable.$inferSelect;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbClient = typeof db | DbTransaction;
type ParseClaim = {
  retryJobToken: string;
  attemptToken: string;
};

/** Delete derived image/cover assets (objects + rows) — re-parse / workflow reset. */
async function clearDerivedAssets(client: DbClient, workId: string): Promise<void> {
  const rows = await client
    .select({ id: contentAssetTable.id, storageKey: contentAssetTable.storageKey, kind: contentAssetTable.kind })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  const cover = await client
    .select({ id: contentAssetTable.id, storageKey: contentAssetTable.storageKey })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'cover')))
    .limit(1);

  for (const row of [...rows, ...cover]) {
    try {
      await deleteObject(row.storageKey);
    } catch (error) {
      ingestLogger.warn({ err: error, workId, storageKey: row.storageKey }, 'Failed to delete derived asset object');
    }
  }

  if (rows.length > 0) {
    await client
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  }
  if (cover.length > 0) {
    await client
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'cover')));
  }

  const audio = await client
    .select()
    .from(contentAssetTable)
    .where(
      and(
        eq(contentAssetTable.workId, workId),
        or(eq(contentAssetTable.kind, 'audio_us'), eq(contentAssetTable.kind, 'audio_uk')),
      ),
    );
  for (const row of audio) {
    await deleteAudioAssetObjects(row);
  }
  if (audio.length > 0) {
    await client.delete(contentAssetTable).where(
      inArray(
        contentAssetTable.id,
        audio.map((row) => row.id),
      ),
    );
  }
}

/** AI-output reset: ai-provenance tag/category associations and ai-filled fields. */
export async function resetMetadataAiOutputs(work: WorkRow, client: DbClient = db): Promise<void> {
  await client
    .delete(readingWorkTagTable)
    .where(and(eq(readingWorkTagTable.workId, work.id), eq(readingWorkTagTable.provenance, 'ai')));
  await client
    .delete(readingWorkCategoryTable)
    .where(and(eq(readingWorkCategoryTable.workId, work.id), eq(readingWorkCategoryTable.provenance, 'ai')));
  if (work.descriptionProvenance === 'ai') {
    await client
      .update(readingWorkTable)
      .set({ description: '', descriptionProvenance: null })
      .where(eq(readingWorkTable.id, work.id));
  }
}

/** Re-parse reset: parts, derived assets, AI outputs, extracted junctions, and filled metadata fields. */
export async function resetParseStepOutputs(work: WorkRow, claim?: ParseClaim): Promise<void> {
  const reset = async (client: DbClient): Promise<void> => {
    await clearDerivedAssets(client, work.id);
    await client.delete(readingPartTable).where(eq(readingPartTable.workId, work.id));
    await resetMetadataAiOutputs(work, client);
    await client
      .delete(readingWorkTagTable)
      .where(and(eq(readingWorkTagTable.workId, work.id), eq(readingWorkTagTable.provenance, 'extracted')));
    await client
      .delete(readingWorkSourceTable)
      .where(and(eq(readingWorkSourceTable.workId, work.id), eq(readingWorkSourceTable.provenance, 'extracted')));
    await client
      .update(readingWorkTable)
      .set({
        title: '',
        author: '',
        description: '',
        coverAssetId: null,
        descriptionProvenance: null,
      })
      .where(eq(readingWorkTable.id, work.id));
  };

  if (!claim) {
    await reset(db);
    return;
  }

  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: readingWorkTable.id })
      .from(readingWorkTable)
      .where(workflowClaimWhere(work.id, 'parse', claim.retryJobToken, claim.attemptToken))
      .for('update');
    if (!owned) {
      throw new Error('Parse workflow lease lost before reset');
    }
    await reset(tx);
  });
}
