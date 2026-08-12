import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import { article as articleTable } from '@elynd/db';
import {
  type Article,
  type CreateArticleBody,
  getPublishArticleIssues,
  type UpdateArticleBody,
} from '@elynd/shared/api/articles';

import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';

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

export async function createArticle(input: CreateArticleBody) {
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
  return toArticle(row);
}

export async function listAdminArticles(status?: 'draft' | 'published') {
  const rows = status
    ? await db.select().from(articleTable).where(eq(articleTable.status, status)).orderBy(desc(articleTable.updatedAt))
    : await db.select().from(articleTable).orderBy(desc(articleTable.updatedAt));

  return rows.map(toArticle);
}

export async function getAdminArticle(id: string) {
  const [row] = await db.select().from(articleTable).where(eq(articleTable.id, id)).limit(1);
  if (!row) {
    throw new NotFoundError('Article');
  }
  return toArticle(row);
}

export async function updateArticle(id: string, input: UpdateArticleBody) {
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
    return toArticle(existing);
  }

  const [row] = await db.update(articleTable).set(patch).where(eq(articleTable.id, id)).returning();
  if (!row) {
    throw new NotFoundError('Article');
  }
  return toArticle(row);
}

export async function publishArticle(id: string) {
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
  return toArticle(row);
}

export async function unpublishArticle(id: string) {
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
  return toArticle(row);
}

export async function listPublishedArticles() {
  const rows = await db
    .select()
    .from(articleTable)
    .where(eq(articleTable.status, 'published'))
    .orderBy(desc(articleTable.publishedAt), desc(articleTable.updatedAt));

  return rows.map(toArticle);
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
