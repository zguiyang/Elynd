import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  conversation as conversationTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
  readingWorkSource as readingWorkSourceTable,
  readingWorkTag as readingWorkTagTable,
  source as sourceTable,
  tag as tagTable,
  type WorkMetadataProvenanceMap,
} from '@gloaming/db';
import {
  type AdminOriginAsset,
  type AdminWork,
  type AdminWorkListData,
  type AdminWorkListQuery,
  type AdminWorkSummary,
  buildPaginationMeta,
  type CatalogListData,
  type CatalogListQuery,
  type CreateAdminTextWorkBody,
  type CreateEpubWorkResult,
  EPUB_UPLOAD_MAX_BYTES,
  getPublishWorkIssues,
  type Part,
  type UpdateWorkBody,
  type Work,
} from '@gloaming/shared/api/works';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { JOB_CONTENT_PARSE } from '@/jobs/content-parse';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { enqueue } from '@/lib/queue';
import { normalizeTag } from '@/lib/text';
import { getWorksDerivedFreshness } from '@/modules/derived-freshness';
import { deleteObject } from '@/modules/oss';
import { deleteBilingualCacheForPart } from '@/modules/translate/service';
import {
  acquireUploadedObject,
  fileExtension,
  isValidContentHash,
  isZipFile,
  releaseUploadedObject,
  type UploadedFileMeta,
  type UploadSpec,
} from '@/modules/uploads/service';

type WorkRow = typeof readingWorkTable.$inferSelect;
type PartRow = typeof readingPartTable.$inferSelect;

const workLogger = rootLogger.child({ module: 'Works' });

function toIso(value: Date): string {
  return value.toISOString();
}

function toWork(row: WorkRow): Work {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    language: row.language,
    status: row.status as Work['status'],
    visibility: row.visibility as Work['visibility'],
    originKind: row.originKind as Work['originKind'],
    tags: row.tags,
    sourceNote: row.sourceNote,
    coverAssetId: row.coverAssetId,
    publishedAt: row.publishedAt ? toIso(row.publishedAt) : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toPart(row: PartRow): Part {
  return {
    id: row.id,
    workId: row.workId,
    sortOrder: row.sortOrder,
    kind: row.kind as Part['kind'],
    title: row.title,
    body: row.body,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function loadPartsForWork(workId: string): Promise<PartRow[]> {
  return db
    .select()
    .from(readingPartTable)
    .where(eq(readingPartTable.workId, workId))
    .orderBy(asc(readingPartTable.sortOrder), asc(readingPartTable.id));
}

async function loadPrimaryPartForWork(workId: string): Promise<PartRow | null> {
  const [row] = await db
    .select()
    .from(readingPartTable)
    .where(eq(readingPartTable.workId, workId))
    .orderBy(asc(readingPartTable.sortOrder), asc(readingPartTable.id))
    .limit(1);
  return row ?? null;
}

async function countPartsForWork(workId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(readingPartTable).where(eq(readingPartTable.workId, workId));
  return Number(row?.value ?? 0);
}

async function loadOriginFileAsset(workId: string): Promise<AdminOriginAsset | null> {
  const [row] = await db
    .select({
      storageKey: contentAssetTable.storageKey,
      mimeType: contentAssetTable.mimeType,
      contentHash: contentAssetTable.contentHash,
      meta: contentAssetTable.meta,
    })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'origin_file')))
    .limit(1);
  if (!row) {
    return null;
  }
  const meta = row.meta ?? {};
  return {
    fileName: String(meta.originalFileName ?? ''),
    size: Number(meta.size ?? 0),
    mimeType: row.mimeType,
    contentHash: row.contentHash,
    reused: Boolean(meta.reused),
  };
}

async function loadSourcesForWork(workId: string): Promise<string[]> {
  const rows = await db
    .select({ name: sourceTable.name })
    .from(readingWorkSourceTable)
    .innerJoin(sourceTable, eq(readingWorkSourceTable.sourceId, sourceTable.id))
    .where(eq(readingWorkSourceTable.workId, workId));
  return rows.map((row) => row.name);
}

async function toAdminWork(row: WorkRow, parts?: PartRow[]): Promise<AdminWork> {
  const partRows = parts ?? (await loadPartsForWork(row.id));
  const primaryPart = partRows[0];
  const freshness = primaryPart
    ? (
        await getWorksDerivedFreshness([
          { id: row.id, partId: primaryPart.id, title: primaryPart.title, body: primaryPart.body },
        ])
      ).get(row.id)
    : { audio: 'missing' as const };
  return {
    ...toWork(row),
    derivedFreshness: freshness ?? { audio: 'missing' },
    originMeta: row.originMeta,
    originAsset: await loadOriginFileAsset(row.id),
    parts: partRows.map(toPart),
    sources: await loadSourcesForWork(row.id),
    metadataEnrichmentStatus: row.metadataEnrichmentStatus,
    metadataEnrichmentAt: row.metadataEnrichmentAt ? toIso(row.metadataEnrichmentAt) : null,
    metadataProvenance: row.metadataProvenance,
  };
}

/** List row projection — part bodies are too heavy for the admin table. */
async function toAdminWorkSummary(row: WorkRow): Promise<AdminWorkSummary> {
  const primaryPart = await loadPrimaryPartForWork(row.id);
  const freshness = primaryPart
    ? (
        await getWorksDerivedFreshness([
          { id: row.id, partId: primaryPart.id, title: primaryPart.title, body: primaryPart.body },
        ])
      ).get(row.id)
    : { audio: 'missing' as const };
  const partCount = await countPartsForWork(row.id);
  return {
    ...toWork(row),
    derivedFreshness: freshness ?? { audio: 'missing' },
    originMeta: row.originMeta,
    originAsset: await loadOriginFileAsset(row.id),
    partCount,
    metadataEnrichmentStatus: row.metadataEnrichmentStatus,
    metadataEnrichmentAt: row.metadataEnrichmentAt ? toIso(row.metadataEnrichmentAt) : null,
    metadataProvenance: row.metadataProvenance,
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function publishedListWhere(query: Pick<CatalogListQuery, 'tag' | 'q'>): SQL {
  const parts: SQL[] = [eq(readingWorkTable.status, 'published')];

  if (query.tag) {
    parts.push(sql`${readingWorkTable.tags} @> ${JSON.stringify([query.tag])}::jsonb`);
  }

  if (query.q) {
    const pattern = `%${escapeIlikePattern(query.q)}%`;
    parts.push(or(ilike(readingWorkTable.title, pattern), sql`${readingWorkTable.tags}::text ilike ${pattern}`)!);
  }

  return and(...parts)!;
}

function publishedListOrderBy(query: Pick<CatalogListQuery, 'sortBy' | 'sortOrder'>) {
  const column =
    query.sortBy === 'createdAt'
      ? readingWorkTable.createdAt
      : query.sortBy === 'updatedAt'
        ? readingWorkTable.updatedAt
        : readingWorkTable.publishedAt;
  const primary = query.sortOrder === 'asc' ? asc(column) : desc(column);
  return [primary, desc(readingWorkTable.id)] as const;
}

function aggregateTags(rows: { tags: string[] }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of rows) {
    for (const tag of row.tags) {
      const key = tag.trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

/** Escape text for HTML body storage. */
function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert a plain-text body (textarea input) into paragraph HTML. */
export function textToParagraphHtml(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtmlText(paragraph)}</p>`)
    .join('\n');
}

/** Internal admin_text seed — creates one work + one body part (stored as HTML). */
export async function createAdminTextWork(input: CreateAdminTextWorkBody): Promise<AdminWork> {
  const workId = randomUUID();
  const partId = randomUUID();

  const [workRow] = await db
    .insert(readingWorkTable)
    .values({
      id: workId,
      title: input.title,
      description: '',
      status: 'draft',
      originKind: 'admin_text',
      tags: [],
      sourceNote: '',
      publishedAt: null,
    })
    .returning();

  if (!workRow) {
    throw new AppError(500, 'Failed to create work');
  }

  const [partRow] = await db
    .insert(readingPartTable)
    .values({
      id: partId,
      workId,
      sortOrder: 0,
      kind: 'body',
      title: input.title,
      body: textToParagraphHtml(input.body),
    })
    .returning();

  if (!partRow) {
    throw new AppError(500, 'Failed to create part');
  }

  return toAdminWork(workRow, [partRow]);
}

/** EPUB upload spec — MVP only accepts EPUB files (UI advertises TXT/PDF but they are rejected). */
export const EPUB_UPLOAD_SPEC: UploadSpec = {
  allowedExtensions: ['epub'],
  allowedMimeTypes: ['application/epub+zip', 'application/zip', 'application/octet-stream'],
  maxBytes: EPUB_UPLOAD_MAX_BYTES,
  validateContent: (body) => (isZipFile(body) ? null : 'EPUB 文件内容无效（非 ZIP 格式）'),
  keyBuilder: (contentHash) => `epub/${contentHash}.epub`,
};

function stripFileExtension(fileName: string): string {
  const extension = fileExtension(fileName);
  return extension ? fileName.slice(0, -(extension.length + 1)) : fileName;
}

/**
 * Create the ReadingWork (draft, admin_epub) + ContentAsset (origin_file) rows
 * that reference an uploaded object. DB stores only the object storage key.
 * On failure the acquired reference is released (may garbage-collect the object).
 */
async function insertEpubWorkAndAsset(input: {
  fileName: string;
  meta: UploadedFileMeta;
  reused: boolean;
}): Promise<CreateEpubWorkResult> {
  const workId = randomUUID();
  const title = stripFileExtension(input.fileName).slice(0, 200) || input.fileName;

  try {
    await db.insert(readingWorkTable).values({
      id: workId,
      title,
      description: '',
      status: 'processing',
      originKind: 'admin_epub',
      originMeta: { originalFileName: input.fileName, reused: input.reused },
      tags: [],
      sourceNote: '',
      publishedAt: null,
    });

    await db.insert(contentAssetTable).values({
      id: randomUUID(),
      workId,
      kind: 'origin_file',
      status: 'ready',
      storageKey: input.meta.storageKey,
      mimeType: input.meta.mimeType,
      contentHash: input.meta.contentHash,
      meta: { size: input.meta.size, originalFileName: input.fileName, reused: input.reused },
    });
  } catch (error) {
    try {
      await releaseUploadedObject(input.meta.storageKey);
    } catch (cleanupError) {
      workLogger.warn({ err: cleanupError, storageKey: input.meta.storageKey }, 'Failed to release upload reference');
    }
    throw error;
  }

  return {
    id: workId,
    title,
    status: 'processing',
    originKind: 'admin_epub',
    originMeta: { originalFileName: input.fileName, reused: input.reused },
    asset: {
      storageKey: input.meta.storageKey,
      mimeType: input.meta.mimeType,
      contentHash: input.meta.contentHash,
      size: input.meta.size,
    },
  };
}

/**
 * Admin EPUB upload (multipart) — dedupe-aware store, then create work + asset.
 * When the same file was uploaded before, the existing object is reused
 * (instant upload, `duplicated: true`) and no bytes are written.
 */
export async function createAdminEpubWork(input: {
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<CreateEpubWorkResult> {
  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new ValidationFailedError([{ path: 'file', message: '请选择要上传的 EPUB 文件' }]);
  }

  const result = await acquireUploadedObject({
    kind: 'file',
    fileName,
    body: input.body,
    contentType: input.contentType,
    spec: EPUB_UPLOAD_SPEC,
  });
  if (!result) {
    throw new AppError(500, 'Failed to upload EPUB');
  }

  const created = await insertEpubWorkAndAsset({
    fileName,
    meta: result.meta,
    reused: result.duplicated,
  });
  await enqueue(JOB_CONTENT_PARSE, { workId: created.id });
  return created;
}

/**
 * Instant upload (reuse) path — client already computed the file hash and asks
 * whether the object exists. Returns null when unknown (caller falls back to a
 * real upload); otherwise creates work + asset reusing the stored object.
 */
export async function reuseAdminEpubWork(input: {
  fileName: string;
  contentHash: string;
}): Promise<CreateEpubWorkResult | null> {
  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new ValidationFailedError([{ path: 'fileName', message: '请提供文件名' }]);
  }
  if (!isValidContentHash(input.contentHash)) {
    throw new ValidationFailedError([{ path: 'contentHash', message: '文件哈希无效' }]);
  }

  const extension = fileExtension(fileName);
  if (!extension || !EPUB_UPLOAD_SPEC.allowedExtensions.includes(extension)) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, '仅支持 .epub 格式文件');
  }

  const result = await acquireUploadedObject({
    kind: 'hash',
    fileName,
    contentHash: input.contentHash,
    spec: EPUB_UPLOAD_SPEC,
  });
  if (!result) {
    return null;
  }

  const created = await insertEpubWorkAndAsset({ fileName, meta: result.meta, reused: true });
  await enqueue(JOB_CONTENT_PARSE, { workId: created.id });
  return created;
}

export async function listAdminWorks(query: AdminWorkListQuery): Promise<AdminWorkListData> {
  const where = query.status ? eq(readingWorkTable.status, query.status) : undefined;
  const primary = query.sortOrder === 'asc' ? asc(readingWorkTable.updatedAt) : desc(readingWorkTable.updatedAt);
  const offset = (query.page - 1) * query.pageSize;

  const [countRow] = where
    ? await db.select({ value: count() }).from(readingWorkTable).where(where)
    : await db.select({ value: count() }).from(readingWorkTable);
  const total = Number(countRow?.value ?? 0);

  const rows = where
    ? await db
        .select()
        .from(readingWorkTable)
        .where(where)
        .orderBy(primary, desc(readingWorkTable.id))
        .limit(query.pageSize)
        .offset(offset)
    : await db
        .select()
        .from(readingWorkTable)
        .orderBy(primary, desc(readingWorkTable.id))
        .limit(query.pageSize)
        .offset(offset);

  const items = await Promise.all(rows.map((row) => toAdminWorkSummary(row)));

  return {
    items,
    pagination: buildPaginationMeta({
      page: query.page,
      pageSize: query.pageSize,
      total,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }),
  };
}

export async function getAdminWork(id: string): Promise<AdminWork> {
  const [row] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!row) {
    throw new NotFoundError('Work');
  }
  return toAdminWork(row);
}

export async function updateWork(id: string, input: UpdateWorkBody): Promise<AdminWork> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
  }

  const patch: Partial<typeof readingWorkTable.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.author !== undefined) patch.author = input.author;
  if (input.description !== undefined) patch.description = input.description;
  if (input.sourceNote !== undefined) patch.sourceNote = input.sourceNote;
  const provenance: WorkMetadataProvenanceMap = { ...existing.metadataProvenance };
  if (input.description !== undefined) provenance.description = 'manual';
  if (input.tags !== undefined) provenance.tags = 'manual';

  if (input.tags === undefined && input.sources === undefined && Object.keys(patch).length === 0) {
    return toAdminWork(existing);
  }

  await db.transaction(async (tx) => {
    if (input.tags !== undefined) {
      const tagIds: string[] = [];
      for (const name of input.tags) {
        const [row] = await tx
          .insert(tagTable)
          .values({ id: randomUUID(), name, normalized: normalizeTag(name) })
          .onConflictDoUpdate({ target: tagTable.normalized, set: { name } })
          .returning();
        tagIds.push(row!.id);
      }
      await tx
        .delete(readingWorkTagTable)
        .where(and(eq(readingWorkTagTable.workId, id), eq(readingWorkTagTable.provenance, 'manual')));
      if (tagIds.length > 0) {
        await tx
          .insert(readingWorkTagTable)
          .values(tagIds.map((tagId) => ({ workId: id, tagId, provenance: 'manual' as const })))
          .onConflictDoNothing();
      }
      const rows = await tx
        .select({ name: tagTable.name })
        .from(readingWorkTagTable)
        .innerJoin(tagTable, eq(readingWorkTagTable.tagId, tagTable.id))
        .where(eq(readingWorkTagTable.workId, id));
      patch.tags = rows.map((row) => row.name);
    }

    if (input.sources !== undefined) {
      const sourceIds: string[] = [];
      for (const name of input.sources) {
        const [row] = await tx
          .insert(sourceTable)
          .values({ id: randomUUID(), name })
          .onConflictDoUpdate({ target: sourceTable.name, set: { name } })
          .returning();
        sourceIds.push(row!.id);
      }
      await tx
        .delete(readingWorkSourceTable)
        .where(and(eq(readingWorkSourceTable.workId, id), eq(readingWorkSourceTable.provenance, 'manual')));
      if (sourceIds.length > 0) {
        await tx
          .insert(readingWorkSourceTable)
          .values(sourceIds.map((sourceId) => ({ workId: id, sourceId, provenance: 'manual' as const })))
          .onConflictDoNothing();
      }
    }

    if (Object.keys(patch).length > 0) {
      if (input.description !== undefined || input.tags !== undefined) {
        patch.metadataProvenance = provenance;
      }
      await tx.update(readingWorkTable).set(patch).where(eq(readingWorkTable.id, id));
    }
  });

  return getAdminWork(id);
}

export async function publishWork(id: string): Promise<AdminWork> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
  }
  if (existing.status !== 'draft') {
    throw new AppError(HTTP_STATUS.CONFLICT, '仅草稿作品可以发布');
  }

  const parts = await loadPartsForWork(id);
  const issues = getPublishWorkIssues({
    title: existing.title,
    sourceNote: existing.sourceNote,
    tags: existing.tags,
    parts: parts.map((part) => ({ body: part.body })),
  });
  if (issues.length > 0) {
    throw new ValidationFailedError(issues);
  }

  const [row] = await db
    .update(readingWorkTable)
    .set({ status: 'published', publishedAt: new Date() })
    .where(eq(readingWorkTable.id, id))
    .returning();

  if (!row) {
    throw new NotFoundError('Work');
  }
  return toAdminWork(row, parts);
}

export async function unpublishWork(id: string): Promise<AdminWork> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
  }
  if (existing.status !== 'published') {
    throw new AppError(HTTP_STATUS.CONFLICT, '仅已发布作品可以下架');
  }

  const [row] = await db
    .update(readingWorkTable)
    .set({ status: 'draft', publishedAt: null })
    .where(eq(readingWorkTable.id, id))
    .returning();

  if (!row) {
    throw new NotFoundError('Work');
  }
  return toAdminWork(row);
}

export async function reparseWork(id: string): Promise<AdminWork> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
  }
  if (existing.status === 'published') {
    throw new AppError(HTTP_STATUS.CONFLICT, '请先下架作品后再重新解析');
  }
  if (existing.status === 'processing') {
    throw new AppError(HTTP_STATUS.CONFLICT, '作品正在解析中，请稍后再试');
  }
  if (existing.originKind !== 'admin_epub') {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, '仅 EPUB 作品支持重新解析');
  }

  const originMeta = { ...existing.originMeta };
  delete originMeta.lastError;
  const [row] = await db
    .update(readingWorkTable)
    .set({ status: 'processing', originMeta })
    .where(eq(readingWorkTable.id, id))
    .returning();
  if (!row) {
    throw new NotFoundError('Work');
  }

  await enqueue(JOB_CONTENT_PARSE, { workId: id });
  return toAdminWork(row);
}

export async function deleteWork(id: string): Promise<void> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
  }
  if (existing.status === 'published') {
    throw new AppError(HTTP_STATUS.CONFLICT, '请先下架');
  }

  const parts = await loadPartsForWork(id);
  const assetRows = await db
    .select({
      storageKey: contentAssetTable.storageKey,
      kind: contentAssetTable.kind,
      partId: contentAssetTable.partId,
    })
    .from(contentAssetTable)
    .where(eq(contentAssetTable.workId, id));

  for (const row of assetRows) {
    if (!row.storageKey) {
      continue;
    }
    if (row.kind === 'origin_file') {
      // Dedup-registered objects: release one reference; garbage-collected at zero.
      await releaseUploadedObject(row.storageKey);
    } else {
      await deleteObject(row.storageKey);
    }
  }

  for (const part of parts) {
    await deleteBilingualCacheForPart(part.id);
  }

  await db
    .delete(conversationTable)
    .where(and(eq(conversationTable.subjectType, 'reading_work'), eq(conversationTable.subjectId, id)));

  await db.delete(readingWorkTable).where(eq(readingWorkTable.id, id));
}

export async function listCatalogWorks(query: CatalogListQuery): Promise<CatalogListData> {
  const where = publishedListWhere(query);
  const orderBy = publishedListOrderBy(query);
  const offset = (query.page - 1) * query.pageSize;

  const [countRow] = await db.select({ value: count() }).from(readingWorkTable).where(where);
  const total = Number(countRow?.value ?? 0);

  const rows = await db
    .select()
    .from(readingWorkTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset(offset);

  const tagRows = await db
    .select({ tags: readingWorkTable.tags })
    .from(readingWorkTable)
    .where(eq(readingWorkTable.status, 'published'));

  return {
    items: rows.map(toWork),
    pagination: buildPaginationMeta({
      page: query.page,
      pageSize: query.pageSize,
      total,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }),
    tags: aggregateTags(tagRows),
  };
}

export async function getPublishedWork(id: string): Promise<Work> {
  const [row] = await db
    .select()
    .from(readingWorkTable)
    .where(and(eq(readingWorkTable.id, id), eq(readingWorkTable.status, 'published')))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Work');
  }
  return toWork(row);
}

export async function requirePublishedWorkWithParts(workId: string): Promise<{ work: WorkRow; parts: PartRow[] }> {
  const [work] = await db
    .select()
    .from(readingWorkTable)
    .where(and(eq(readingWorkTable.id, workId), eq(readingWorkTable.status, 'published')))
    .limit(1);
  if (!work) {
    throw new NotFoundError('Work');
  }
  const parts = await loadPartsForWork(workId);
  if (parts.length === 0) {
    throw new NotFoundError('Part');
  }
  return { work, parts };
}

export async function getPartById(partId: string): Promise<PartRow> {
  const [row] = await db.select().from(readingPartTable).where(eq(readingPartTable.id, partId)).limit(1);
  if (!row) {
    throw new NotFoundError('Part');
  }
  return row;
}
