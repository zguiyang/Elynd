import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';

import { article as articleTable } from '@elynd/db';
import {
  type AdminArticle,
  type AdminArticleListData,
  type AdminArticleListQuery,
  type Article,
  buildPaginationMeta,
  type CreateArticleBody,
  type DerivedFreshness,
  getPublishArticleIssues,
  type LibraryArticleListData,
  type LibraryArticleListQuery,
  type UpdateArticleBody,
} from '@elynd/shared/api/articles';

import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';
import { getArticleDerivedFreshness, getArticlesDerivedFreshness } from '@/modules/derived-freshness';

type ArticleRow = typeof articleTable.$inferSelect;

function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    level: row.level as Article['level'],
    themes: row.themes,
    sourceNote: row.sourceNote,
    status: row.status as Article['status'],
    seriesId: row.seriesId,
    seriesOrder: row.seriesOrder,
    estimatedMinutes: row.estimatedMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

async function toAdminArticle(row: ArticleRow, freshness?: DerivedFreshness): Promise<AdminArticle> {
  const derivedFreshness =
    freshness ?? (await getArticleDerivedFreshness({ id: row.id, title: row.title, body: row.body }));
  return {
    ...toArticle(row),
    derivedFreshness,
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function publishedListWhere(query: Pick<LibraryArticleListQuery, 'theme' | 'q'>): SQL {
  const parts: SQL[] = [eq(articleTable.status, 'published')];

  if (query.theme) {
    parts.push(sql`${articleTable.themes} @> ${JSON.stringify([query.theme])}::jsonb`);
  }

  if (query.q) {
    const pattern = `%${escapeIlikePattern(query.q)}%`;
    parts.push(or(ilike(articleTable.title, pattern), sql`${articleTable.themes}::text ilike ${pattern}`)!);
  }

  return and(...parts)!;
}

function publishedListOrderBy(query: Pick<LibraryArticleListQuery, 'sortBy' | 'sortOrder'>) {
  const column =
    query.sortBy === 'createdAt'
      ? articleTable.createdAt
      : query.sortBy === 'updatedAt'
        ? articleTable.updatedAt
        : articleTable.publishedAt;
  const primary = query.sortOrder === 'asc' ? asc(column) : desc(column);
  return [primary, desc(articleTable.id)] as const;
}

function aggregateThemes(rows: { themes: string[] }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const row of rows) {
    for (const theme of row.themes) {
      const key = theme.trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(key);
    }
  }
  return ordered;
}

export async function createArticle(input: CreateArticleBody): Promise<AdminArticle> {
  const id = randomUUID();
  const [row] = await db
    .insert(articleTable)
    .values({
      id,
      title: input.title,
      body: input.body,
      level: input.level,
      themes: input.themes,
      sourceNote: input.sourceNote,
      status: 'draft',
      seriesId: input.seriesId,
      seriesOrder: input.seriesOrder,
      estimatedMinutes: input.estimatedMinutes,
      publishedAt: null,
    })
    .returning();

  if (!row) {
    throw new AppError(500, 'Failed to create article');
  }
  return toAdminArticle(row, { audio: 'missing' });
}

export async function listAdminArticles(query: AdminArticleListQuery): Promise<AdminArticleListData> {
  const where = query.status ? eq(articleTable.status, query.status) : undefined;
  const primary = query.sortOrder === 'asc' ? asc(articleTable.updatedAt) : desc(articleTable.updatedAt);
  const offset = (query.page - 1) * query.pageSize;

  const [countRow] = where
    ? await db.select({ value: count() }).from(articleTable).where(where)
    : await db.select({ value: count() }).from(articleTable);
  const total = Number(countRow?.value ?? 0);

  const rows = where
    ? await db
        .select()
        .from(articleTable)
        .where(where)
        .orderBy(primary, desc(articleTable.id))
        .limit(query.pageSize)
        .offset(offset)
    : await db.select().from(articleTable).orderBy(primary, desc(articleTable.id)).limit(query.pageSize).offset(offset);

  const freshnessMap = await getArticlesDerivedFreshness(
    rows.map((row) => ({ id: row.id, title: row.title, body: row.body })),
  );

  return {
    items: await Promise.all(rows.map((row) => toAdminArticle(row, freshnessMap.get(row.id)))),
    pagination: buildPaginationMeta({
      page: query.page,
      pageSize: query.pageSize,
      total,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }),
  };
}

export async function getAdminArticle(id: string): Promise<AdminArticle> {
  const [row] = await db.select().from(articleTable).where(eq(articleTable.id, id)).limit(1);
  if (!row) {
    throw new NotFoundError('Article');
  }
  return toAdminArticle(row);
}

export async function updateArticle(id: string, input: UpdateArticleBody): Promise<AdminArticle> {
  const [existing] = await db.select().from(articleTable).where(eq(articleTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Article');
  }

  const patch: Partial<typeof articleTable.$inferInsert> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.level !== undefined) patch.level = input.level;
  if (input.themes !== undefined) patch.themes = input.themes;
  if (input.sourceNote !== undefined) patch.sourceNote = input.sourceNote;
  if (input.seriesId !== undefined) patch.seriesId = input.seriesId;
  if (input.seriesOrder !== undefined) patch.seriesOrder = input.seriesOrder;
  if (input.estimatedMinutes !== undefined) patch.estimatedMinutes = input.estimatedMinutes;

  if (Object.keys(patch).length === 0) {
    return toAdminArticle(existing);
  }

  const [row] = await db.update(articleTable).set(patch).where(eq(articleTable.id, id)).returning();
  if (!row) {
    throw new NotFoundError('Article');
  }
  return toAdminArticle(row);
}

export async function publishArticle(id: string): Promise<AdminArticle> {
  const [existing] = await db.select().from(articleTable).where(eq(articleTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Article');
  }

  const issues = getPublishArticleIssues({
    title: existing.title,
    body: existing.body,
    sourceNote: existing.sourceNote,
    themes: existing.themes,
    seriesId: existing.seriesId,
    seriesOrder: existing.seriesOrder,
  });
  if (issues.length > 0) {
    throw new ValidationFailedError(issues);
  }

  const publishedAt = existing.status === 'published' && existing.publishedAt ? existing.publishedAt : new Date();
  const [row] = await db
    .update(articleTable)
    .set({ status: 'published', publishedAt })
    .where(eq(articleTable.id, id))
    .returning();

  if (!row) {
    throw new NotFoundError('Article');
  }
  return toAdminArticle(row);
}

export async function unpublishArticle(id: string): Promise<AdminArticle> {
  const [existing] = await db.select().from(articleTable).where(eq(articleTable.id, id)).limit(1);
  if (!existing) {
    throw new NotFoundError('Article');
  }

  const [row] = await db
    .update(articleTable)
    .set({ status: 'draft', publishedAt: null })
    .where(eq(articleTable.id, id))
    .returning();

  if (!row) {
    throw new NotFoundError('Article');
  }
  return toAdminArticle(row);
}

export async function listPublishedArticles(query: LibraryArticleListQuery): Promise<LibraryArticleListData> {
  const where = publishedListWhere(query);
  const orderBy = publishedListOrderBy(query);
  const offset = (query.page - 1) * query.pageSize;

  const [countRow] = await db.select({ value: count() }).from(articleTable).where(where);
  const total = Number(countRow?.value ?? 0);

  const rows = await db
    .select()
    .from(articleTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset(offset);

  const themeRows = await db
    .select({ themes: articleTable.themes })
    .from(articleTable)
    .where(eq(articleTable.status, 'published'));

  return {
    items: rows.map(toArticle),
    pagination: buildPaginationMeta({
      page: query.page,
      pageSize: query.pageSize,
      total,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }),
    themes: aggregateThemes(themeRows),
  };
}

export async function getPublishedArticle(id: string) {
  const [row] = await db
    .select()
    .from(articleTable)
    .where(and(eq(articleTable.id, id), eq(articleTable.status, 'published')))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Article');
  }
  return toArticle(row);
}
