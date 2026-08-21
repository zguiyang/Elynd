import { randomUUID } from 'node:crypto';

import { and, desc, eq, ne, notExists } from 'drizzle-orm';

import { article as articleTable, readingProgress as readingProgressTable } from '@gloaming/db';
import {
  LEARN_CONTINUE_READING_LIMIT,
  LEARN_SHELF_ITEMS_LIMIT,
  LEARN_TODAY_RECOMMENDATIONS_LIMIT,
  type LearnArticleData,
  type LearnArticleSummary,
  type LearnShelfData,
  type LearnTodayData,
  type UpdateReadingProgressBody,
} from '@gloaming/shared/api/learn';

import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { getArticleAudioAvailability } from '@/modules/article-audio/service';
import { touchLearnerDay } from '@/modules/progress/service';

type ArticleRow = typeof articleTable.$inferSelect;
type ProgressRow = typeof readingProgressTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toSummary(row: ArticleRow): LearnArticleSummary {
  return {
    id: row.id,
    title: row.title,
    level: row.level as LearnArticleSummary['level'],
    themes: row.themes,
    estimatedMinutes: row.estimatedMinutes,
  };
}

function toProgress(row: ProgressRow) {
  return {
    status: row.status as LearnArticleData['progress']['status'],
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

export async function getToday(userId: string): Promise<LearnTodayData> {
  const progressRows = await db
    .select({
      progress: readingProgressTable,
      article: articleTable,
    })
    .from(readingProgressTable)
    .innerJoin(articleTable, eq(readingProgressTable.articleId, articleTable.id))
    .where(
      and(
        eq(readingProgressTable.userId, userId),
        eq(readingProgressTable.status, 'in_progress'),
        eq(articleTable.status, 'published'),
      ),
    )
    .orderBy(desc(readingProgressTable.lastReadAt), desc(readingProgressTable.id))
    .limit(LEARN_CONTINUE_READING_LIMIT + 1);

  const currentRow = progressRows[0] ?? null;
  const continueRows = progressRows.slice(1, LEARN_CONTINUE_READING_LIMIT + 1);

  const recommendationRows = await db
    .select()
    .from(articleTable)
    .where(
      and(
        eq(articleTable.status, 'published'),
        notExists(
          db
            .select({ id: readingProgressTable.id })
            .from(readingProgressTable)
            .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.articleId, articleTable.id))),
        ),
      ),
    )
    .orderBy(desc(articleTable.publishedAt), desc(articleTable.id))
    .limit(LEARN_TODAY_RECOMMENDATIONS_LIMIT);

  return {
    current: currentRow ? { article: toSummary(currentRow.article), progress: toProgress(currentRow.progress) } : null,
    continueReading: continueRows.map((row) => ({
      article: toSummary(row.article),
      progress: toProgress(row.progress),
    })),
    recommendations: recommendationRows.map((row) => toSummary(row)),
  };
}

/** My shelf: latest in-progress as continue hero; remaining progress rows as grid. */
export async function getShelf(userId: string): Promise<LearnShelfData> {
  const [currentRow] = await db
    .select({
      progress: readingProgressTable,
      article: articleTable,
    })
    .from(readingProgressTable)
    .innerJoin(articleTable, eq(readingProgressTable.articleId, articleTable.id))
    .where(
      and(
        eq(readingProgressTable.userId, userId),
        eq(readingProgressTable.status, 'in_progress'),
        eq(articleTable.status, 'published'),
      ),
    )
    .orderBy(desc(readingProgressTable.lastReadAt), desc(readingProgressTable.id))
    .limit(1);

  const itemConditions = [
    eq(readingProgressTable.userId, userId),
    eq(articleTable.status, 'published'),
    ...(currentRow ? [ne(readingProgressTable.id, currentRow.progress.id)] : []),
  ];

  const itemRows = await db
    .select({
      progress: readingProgressTable,
      article: articleTable,
    })
    .from(readingProgressTable)
    .innerJoin(articleTable, eq(readingProgressTable.articleId, articleTable.id))
    .where(and(...itemConditions))
    .orderBy(desc(readingProgressTable.lastReadAt), desc(readingProgressTable.id))
    .limit(LEARN_SHELF_ITEMS_LIMIT);

  return {
    current: currentRow ? { article: toSummary(currentRow.article), progress: toProgress(currentRow.progress) } : null,
    items: itemRows.map((row) => ({
      article: toSummary(row.article),
      progress: toProgress(row.progress),
    })),
  };
}

/** Open Learning Room: touch / upsert progress (unless already completed). */
export async function getLearnArticle(userId: string, articleId: string): Promise<LearnArticleData> {
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
  await touchLearnerDay(userId);

  return {
    id: article.id,
    title: article.title,
    body: article.body,
    level: article.level as LearnArticleData['level'],
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
): Promise<LearnArticleData['progress']> {
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
