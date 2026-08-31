import { createHash, randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
} from '@gloaming/db';
import { WORKFLOW_AUTO_CHAIN } from '@gloaming/shared/api/works';

import { db } from '@/db';
import { rootLogger } from '@/lib/logger';
import { claimWorkflowStep, failWorkflowStep } from '@/lib/workflow';
import { parserFor } from '@/modules/content-parser/registry';
import type { ParsedContent } from '@/modules/content-parser/types';
import { deleteObject, getObject, putObject } from '@/modules/oss';

const ingestLogger = rootLogger.child({ module: 'ContentParser' });

/** Max images extracted per book (abuse / runaway protection). */
const MAX_BOOK_IMAGES = 200;

type WorkRow = typeof readingWorkTable.$inferSelect;

function imageKey(workId: string, contentHash: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `book-images/${workId}/${contentHash}.${ext}`;
}

function coverKey(workId: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `covers/${workId}.${ext}`;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadOriginBytes(workId: string): Promise<Buffer> {
  const [asset] = await db
    .select({ storageKey: contentAssetTable.storageKey })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'origin_file')))
    .limit(1);
  if (!asset) {
    throw new Error(`Work ${workId} has no origin_file asset`);
  }
  const object = await getObject(asset.storageKey);
  if (!object) {
    throw new Error(`Origin file object missing: ${asset.storageKey}`);
  }
  return object.body;
}

/** Delete derived image/cover assets (objects + rows) — re-parse / workflow reset. */
export async function clearDerivedAssets(workId: string): Promise<void> {
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
}

/** Rewrite placeholder tokens to published asset URLs (or drop unresolved ones). */
function rewriteImageSrcs(html: string, images: ParsedContent['images'], hrefToAssetId: Map<string, string>): string {
  let out = html;
  for (const image of images) {
    const assetId = hrefToAssetId.get(image.href);
    if (assetId) {
      out = out.split(image.token).join(`/api/assets/${assetId}`);
    } else {
      out = out.split(image.token).join('');
    }
  }
  return out;
}

/**
 * Content ingest job — resolve the source parser, then store parts/images/cover
 * and update the work. Idempotent: re-running replaces parts + derived assets.
 * Claims the `parse` workflow step (self-heals from a failed parse retry) and
 * moves the work to `metadata` (auto-chain) or `parsed` (manual next) on success.
 */
export async function processContentWork(workId: string): Promise<void> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    throw new Error(`Work ${workId} not found`);
  }
  if (!(await claimWorkflowStep(workId, 'parse'))) {
    return;
  }

  try {
    const bytes = await loadOriginBytes(workId);
    const parser = parserFor(work.originKind);
    const content = await parser.parse(bytes);

    if (content.chapters.length === 0) {
      throw new Error(`${work.originKind} produced no readable chapters`);
    }

    await clearDerivedAssets(workId);

    // Only store images referenced by chapters that survived planning — a
    // dropped cover page must not leak its image into the body image set.
    const chapterHtml = content.chapters.map((chapter) => chapter.html).join('\n');
    const usedImages = content.images.filter((image) => chapterHtml.includes(image.token)).slice(0, MAX_BOOK_IMAGES);

    // Store images → content_asset rows → final src URLs.
    const hrefToAssetId = new Map<string, string>();
    let storedImages = 0;
    for (const image of usedImages) {
      const hash = sha256(image.bytes);
      const key = imageKey(workId, hash, image.mime);
      await putObject({ key, body: image.bytes, contentType: image.mime });
      const assetId = randomUUID();
      await db.insert(contentAssetTable).values({
        id: assetId,
        workId,
        kind: 'image',
        storageKey: key,
        mimeType: image.mime,
        contentHash: hash,
        meta: { originalPath: image.href, size: image.bytes.length },
        status: 'ready',
      });
      hrefToAssetId.set(image.href, assetId);
      storedImages += 1;
    }

    // Cover asset.
    let coverAssetId: string | null = null;
    if (content.cover) {
      const key = coverKey(workId, content.cover.mime);
      await putObject({ key, body: content.cover.bytes, contentType: content.cover.mime });
      const assetId = randomUUID();
      await db.insert(contentAssetTable).values({
        id: assetId,
        workId,
        kind: 'cover',
        storageKey: key,
        mimeType: content.cover.mime,
        contentHash: sha256(content.cover.bytes),
        meta: { originalPath: content.cover.originalPath, size: content.cover.bytes.length },
        status: 'ready',
      });
      coverAssetId = assetId;
    }

    // Replace parts (idempotent re-parse).
    await db.delete(readingPartTable).where(eq(readingPartTable.workId, workId));
    for (let i = 0; i < content.chapters.length; i += 1) {
      const chapter = content.chapters[i]!;
      await db.insert(readingPartTable).values({
        id: randomUUID(),
        workId,
        sortOrder: i,
        kind: 'chapter',
        title: chapter.title.slice(0, 200),
        body: rewriteImageSrcs(chapter.html, usedImages, hrefToAssetId),
      });
    }

    // Metadata: title/author/description/language land via the metadata-fill
    // job (rule layer). content-parse only decides first-parse vs re-parse:
    // on first parse the upload placeholder title (file name) is cleared so
    // fill can take the parsed value; on re-parse hand-edited values stay.
    const hasParsedBefore = Boolean(work.originMeta?.parsed);
    const metadata = content.metadata;

    await db
      .update(readingWorkTable)
      .set({
        title: hasParsedBefore ? work.title : '',
        author: hasParsedBefore ? work.author : '',
        description: hasParsedBefore ? work.description : '',
        coverAssetId,
        status: WORKFLOW_AUTO_CHAIN ? 'metadata' : 'parsed',
        publishedAt: null,
        originMeta: {
          ...work.originMeta,
          parsed: {
            opfTitle: metadata.title,
            authors: metadata.authors,
            description: metadata.description,
            language: metadata.language,
            subjects: metadata.subjects,
            sourceRaw: metadata.sourceRaw,
            coverHref: content.cover?.originalPath ?? null,
            spineCount: content.stats.spineCount,
            navCount: content.stats.navCount,
            chapterCount: content.stats.chapterCount,
            imageCount: storedImages,
            parsedAt: new Date().toISOString(),
          },
          failedStep: undefined,
          lastError: undefined,
          failedAt: undefined,
        },
      })
      .where(eq(readingWorkTable.id, workId));

    ingestLogger.info({ workId, chapters: content.chapters.length, images: storedImages }, 'Content ingest complete');
  } catch (error) {
    ingestLogger.error({ err: error, workId }, 'Content ingest failed');
    await failWorkflowStep(workId, 'parse', error);
    throw error;
  }
}

export type { WorkRow as ContentWorkRow };
