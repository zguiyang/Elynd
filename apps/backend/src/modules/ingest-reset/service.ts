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
import { deleteAudioAssetObjects } from '@/modules/content-assets/service';
import { deleteObject } from '@/modules/oss';

const ingestLogger = rootLogger.child({ module: 'IngestReset' });

type WorkRow = typeof readingWorkTable.$inferSelect;

/** Delete derived image/cover assets (objects + rows) — re-parse / workflow reset. */
async function clearDerivedAssets(workId: string): Promise<void> {
  const rows = await db
    .select({ id: contentAssetTable.id, storageKey: contentAssetTable.storageKey, kind: contentAssetTable.kind })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  const cover = await db
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
    await db
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  }
  if (cover.length > 0) {
    await db
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'cover')));
  }

  const audio = await db
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
    await db.delete(contentAssetTable).where(
      inArray(
        contentAssetTable.id,
        audio.map((row) => row.id),
      ),
    );
  }
}

/** AI-output reset: ai-provenance tag/category associations and ai-filled fields. */
export async function resetMetadataAiOutputs(work: WorkRow): Promise<void> {
  await db
    .delete(readingWorkTagTable)
    .where(and(eq(readingWorkTagTable.workId, work.id), eq(readingWorkTagTable.provenance, 'ai')));
  await db
    .delete(readingWorkCategoryTable)
    .where(and(eq(readingWorkCategoryTable.workId, work.id), eq(readingWorkCategoryTable.provenance, 'ai')));
  if (work.descriptionProvenance === 'ai') {
    await db
      .update(readingWorkTable)
      .set({ description: '', descriptionProvenance: null })
      .where(eq(readingWorkTable.id, work.id));
  }
}

/** Re-parse reset: parts, derived assets, AI outputs, extracted junctions, and filled metadata fields. */
export async function resetParseStepOutputs(work: WorkRow): Promise<void> {
  await clearDerivedAssets(work.id);
  await db.delete(readingPartTable).where(eq(readingPartTable.workId, work.id));
  await resetMetadataAiOutputs(work);
  await db
    .delete(readingWorkTagTable)
    .where(and(eq(readingWorkTagTable.workId, work.id), eq(readingWorkTagTable.provenance, 'extracted')));
  await db
    .delete(readingWorkSourceTable)
    .where(and(eq(readingWorkSourceTable.workId, work.id), eq(readingWorkSourceTable.provenance, 'extracted')));
  await db
    .update(readingWorkTable)
    .set({
      title: '',
      author: '',
      description: '',
      coverAssetId: null,
      descriptionProvenance: null,
    })
    .where(eq(readingWorkTable.id, work.id));
}
