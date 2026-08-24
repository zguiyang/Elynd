import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { article as articleTable, readingProgress as readingProgressTable } from '@gloaming/db';
import { type ReaderSessionData, type UpdateReadingProgressBody } from '@gloaming/shared/api/reader';

import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { getArticleAudioAvailability } from '@/modules/article-audio/service';
import { touchReadingDay } from '@/modules/reading-history/service';

type ArticleRow = typeof articleTable.$inferSelect;
type ProgressRow = typeof readingProgressTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toProgress(row: ProgressRow) {
  return {
    status: row.status as ReaderSessionData['progress']['status'],
    progressRatio: row.progressRatio,
    lastReadAt: toIso(row.lastReadAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
  };
}

async function requirePublishedArticle(articleId: string): Promise<ArticleRow> {
  const [row] = await db
    .select()
    .from(articleTable)
    .where(and(eq(articleTable.id, articleId), eq(articleTable.status, 'published')))
    .limit(1);
  if (!row) {
    throw new NotFoundError('Article');
  }
  return row;
}

/** Read-only reader payload for anonymous visitors; no user data is created. */
export async function getPublicReaderSession(articleId: string): Promise<ReaderSessionData> {
  const article = await requirePublishedArticle(articleId);
  const now = new Date().toISOString();
  const audioAvailable = await getArticleAudioAvailability(articleId);

  return {
    id: article.id,
    title: article.title,
    body: article.body,
    level: article.level as ReaderSessionData['level'],
    themes: article.themes,
    estimatedMinutes: article.estimatedMinutes,
    progress: {
      status: 'in_progress',
      progressRatio: 0,
      lastReadAt: now,
      completedAt: null,
    },
    audioAvailable,
  };
}

/** Open reader content and track reading progress (unless already completed). */
export async function getReaderSession(userId: string, articleId: string): Promise<ReaderSessionData> {
  const article = await requirePublishedArticle(articleId);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(readingProgressTable)
    .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.articleId, articleId)))
    .limit(1);

  let progress: ProgressRow;
  if (!existing) {
    const [created] = await db
      .insert(readingProgressTable)
      .values({
        id: randomUUID(),
        userId,
        articleId,
        status: 'in_progress',
        progressRatio: 0,
        lastReadAt: now,
        completedAt: null,
      })
      .returning();
    if (!created) {
      throw new AppError(500, 'Failed to create reading progress');
    }
    progress = created;
  } else if (existing.status === 'completed') {
    const [updated] = await db
      .update(readingProgressTable)
      .set({ lastReadAt: now })
      .where(eq(readingProgressTable.id, existing.id))
      .returning();
    progress = updated ?? existing;
  } else {
    const [updated] = await db
      .update(readingProgressTable)
      .set({ lastReadAt: now })
      .where(eq(readingProgressTable.id, existing.id))
      .returning();
    progress = updated ?? existing;
  }

  const audioAvailable = await getArticleAudioAvailability(articleId);
  await touchReadingDay(userId);

  return {
    id: article.id,
    title: article.title,
    body: article.body,
    level: article.level as ReaderSessionData['level'],
    themes: article.themes,
    estimatedMinutes: article.estimatedMinutes,
    progress: toProgress(progress),
    audioAvailable,
  };
}

export async function updateReadingProgress(
  userId: string,
  articleId: string,
  input: UpdateReadingProgressBody,
): Promise<ReaderSessionData['progress']> {
  await requirePublishedArticle(articleId);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(readingProgressTable)
    .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.articleId, articleId)))
    .limit(1);

  const nextRatio =
    input.progressRatio !== undefined
      ? Math.max(existing?.progressRatio ?? 0, input.progressRatio)
      : (existing?.progressRatio ?? 0);

  const nextStatus = input.status ?? existing?.status ?? 'in_progress';
  const completedAt =
    nextStatus === 'completed'
      ? (existing?.completedAt ?? now)
      : nextStatus === 'in_progress'
        ? null
        : existing?.completedAt;

  if (!existing) {
    const [created] = await db
      .insert(readingProgressTable)
      .values({
        id: randomUUID(),
        userId,
        articleId,
        status: nextStatus,
        progressRatio: nextRatio,
        lastReadAt: now,
        completedAt,
      })
      .returning();
    if (!created) {
      throw new AppError(500, 'Failed to create reading progress');
    }
    return toProgress(created);
  }

  const [updated] = await db
    .update(readingProgressTable)
    .set({
      status: nextStatus,
      progressRatio: nextRatio,
      lastReadAt: now,
      completedAt,
    })
    .where(eq(readingProgressTable.id, existing.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Reading progress');
  }
  return toProgress(updated);
}
