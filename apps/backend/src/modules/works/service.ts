import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  conversation as conversationTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
} from '@gloaming/db';
import {
  type AdminWork,
  type AdminWorkListData,
  type AdminWorkListQuery,
  buildPaginationMeta,
  type CatalogListData,
  type CatalogListQuery,
  type CreateAdminTextWorkBody,
  getPublishWorkIssues,
  type Part,
  type UpdatePartBody,
  type UpdateWorkBody,
  type Work,
} from '@gloaming/shared/api/works';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';
import { getWorksDerivedFreshness } from '@/modules/derived-freshness';
import { deleteObject } from '@/modules/oss';
import { deleteBilingualCacheForPart } from '@/modules/translate/service';

type WorkRow = typeof readingWorkTable.$inferSelect;
type PartRow = typeof readingPartTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toWork(row: WorkRow): Work {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    language: row.language,
    status: row.status as Work['status'],
    visibility: row.visibility as Work['visibility'],
    originKind: row.originKind as Work['originKind'],
    tags: row.tags,
    sourceNote: row.sourceNote,
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
    parts: partRows.map(toPart),
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

/** Internal admin_text seed — creates one work + one body part. */
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
      body: input.body,
    })
    .returning();

  if (!partRow) {
    throw new AppError(500, 'Failed to create part');
  }

  return toAdminWork(workRow, [partRow]);
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

  const items = await Promise.all(rows.map((row) => toAdminWork(row)));

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
  if (input.description !== undefined) patch.description = input.description;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.sourceNote !== undefined) patch.sourceNote = input.sourceNote;

  if (Object.keys(patch).length === 0) {
    return toAdminWork(existing);
  }

  const [row] = await db.update(readingWorkTable).set(patch).where(eq(readingWorkTable.id, id)).returning();
  if (!row) {
    throw new NotFoundError('Work');
  }
  return toAdminWork(row);
}

export async function updatePart(workId: string, partId: string, input: UpdatePartBody): Promise<AdminWork> {
  const [existing] = await db
    .select()
    .from(readingPartTable)
    .where(and(eq(readingPartTable.id, partId), eq(readingPartTable.workId, workId)))
    .limit(1);
  if (!existing) {
    throw new NotFoundError('Part');
  }

  const patch: Partial<typeof readingPartTable.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;

  if (Object.keys(patch).length > 0) {
    await db.update(readingPartTable).set(patch).where(eq(readingPartTable.id, partId));
  }

  return getAdminWork(workId);
}

export async function publishWork(id: string): Promise<AdminWork> {
  const [existing] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Work');
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

  const publishedAt = existing.status === 'published' && existing.publishedAt ? existing.publishedAt : new Date();
  const [row] = await db
    .update(readingWorkTable)
    .set({ status: 'published', publishedAt })
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
    .select({ storageKey: contentAssetTable.storageKey, partId: contentAssetTable.partId })
    .from(contentAssetTable)
    .where(eq(contentAssetTable.workId, id));

  for (const row of assetRows) {
    if (row.storageKey) {
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
