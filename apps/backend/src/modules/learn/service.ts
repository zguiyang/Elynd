import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq } from 'drizzle-orm';

import {
  article as articleTable,
  practiceAttempt as practiceAttemptTable,
  type PracticeAttemptAnswer as DbPracticeAttemptAnswer,
  practiceItem as practiceItemTable,
  type PracticeItemPayload as DbPracticeItemPayload,
  readingProgress as readingProgressTable,
} from '@elynd/db';
import {
  type AdminPracticeItemsData,
  LEARN_CONTINUE_READING_LIMIT,
  type LearnArticleData,
  type LearnArticleSummary,
  type LearnerPracticeItem,
  type LearnPracticeData,
  type LearnTodayData,
  type PracticeAttempt,
  type PracticeAttemptAnswer,
  type PracticeItemKind,
  type ReplacePracticeItemsBody,
  type UpdatePracticeAttemptBody,
  type UpdateReadingProgressBody,
} from '@elynd/shared/api/learn';

import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';

type ArticleRow = typeof articleTable.$inferSelect;
type ProgressRow = typeof readingProgressTable.$inferSelect;
type PracticeItemRow = typeof practiceItemTable.$inferSelect;
type AttemptRow = typeof practiceAttemptTable.$inferSelect;

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

function toLearnerItem(row: PracticeItemRow): LearnerPracticeItem {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    kind: row.kind as PracticeItemKind,
    payload: row.payload,
  };
}

function toAdminItem(row: PracticeItemRow) {
  return {
    ...toLearnerItem(row),
    correctOptionIndex: row.correctOptionIndex,
  };
}

function toAttempt(row: AttemptRow): PracticeAttempt {
  return {
    id: row.id,
    articleId: row.articleId,
    status: row.status as PracticeAttempt['status'],
    currentIndex: row.currentIndex,
    answers: row.answers as PracticeAttemptAnswer[],
    startedAt: toIso(row.startedAt),
    finishedAt: row.finishedAt ? toIso(row.finishedAt) : null,
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

async function requireArticleExists(articleId: string): Promise<ArticleRow> {
  const [row] = await db.select().from(articleTable).where(eq(articleTable.id, articleId)).limit(1);
  if (!row) {
    throw new NotFoundError('Article');
  }
  return row;
}

async function countPracticeItems(articleId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(practiceItemTable)
    .where(eq(practiceItemTable.articleId, articleId));
  return Number(row?.value ?? 0);
}

async function listPracticeItemRows(articleId: string): Promise<PracticeItemRow[]> {
  return db
    .select()
    .from(practiceItemTable)
    .where(eq(practiceItemTable.articleId, articleId))
    .orderBy(asc(practiceItemTable.sortOrder), asc(practiceItemTable.id));
}

async function findInProgressAttempt(userId: string, articleId: string): Promise<AttemptRow | null> {
  const [row] = await db
    .select()
    .from(practiceAttemptTable)
    .where(
      and(
        eq(practiceAttemptTable.userId, userId),
        eq(practiceAttemptTable.articleId, articleId),
        eq(practiceAttemptTable.status, 'in_progress'),
      ),
    )
    .limit(1);
  return row ?? null;
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

  const [activeAttempt] = await db
    .select({
      attempt: practiceAttemptTable,
      article: articleTable,
    })
    .from(practiceAttemptTable)
    .innerJoin(articleTable, eq(practiceAttemptTable.articleId, articleTable.id))
    .where(
      and(
        eq(practiceAttemptTable.userId, userId),
        eq(practiceAttemptTable.status, 'in_progress'),
        eq(articleTable.status, 'published'),
      ),
    )
    .orderBy(desc(practiceAttemptTable.updatedAt), desc(practiceAttemptTable.id))
    .limit(1);

  let activePractice: LearnTodayData['activePractice'] = null;
  if (activeAttempt) {
    const totalItems = await countPracticeItems(activeAttempt.article.id);
    activePractice = {
      articleId: activeAttempt.article.id,
      articleTitle: activeAttempt.article.title,
      attemptId: activeAttempt.attempt.id,
      currentIndex: activeAttempt.attempt.currentIndex,
      totalItems,
    };
  }

  return {
    current: currentRow ? { article: toSummary(currentRow.article), progress: toProgress(currentRow.progress) } : null,
    continueReading: continueRows.map((row) => ({
      article: toSummary(row.article),
      progress: toProgress(row.progress),
    })),
    activePractice,
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

  const practiceAvailable = (await countPracticeItems(articleId)) > 0;

  return {
    id: article.id,
    title: article.title,
    body: article.body,
    level: article.level as LearnArticleData['level'],
    themes: article.themes,
    estimatedMinutes: article.estimatedMinutes,
    progress: toProgress(progress),
    practiceAvailable,
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

export async function getAdminPracticeItems(articleId: string): Promise<AdminPracticeItemsData> {
  await requireArticleExists(articleId);
  const rows = await listPracticeItemRows(articleId);
  return { items: rows.map(toAdminItem) };
}

export async function replaceAdminPracticeItems(
  articleId: string,
  body: ReplacePracticeItemsBody,
): Promise<AdminPracticeItemsData> {
  await requireArticleExists(articleId);

  const items = body.items.map((item, index) => ({
    ...item,
    sortOrder: item.sortOrder ?? index + 1,
  }));

  const sortOrders = items.map((item) => item.sortOrder);
  if (new Set(sortOrders).size !== sortOrders.length) {
    throw new ValidationFailedError([{ path: 'items', message: 'sortOrder values must be unique' }]);
  }

  await db.transaction(async (tx) => {
    await tx.delete(practiceItemTable).where(eq(practiceItemTable.articleId, articleId));
    if (items.length === 0) {
      return;
    }
    await tx.insert(practiceItemTable).values(
      items.map((item) => ({
        id: randomUUID(),
        articleId,
        sortOrder: item.sortOrder,
        kind: item.kind,
        payload: item.payload as DbPracticeItemPayload,
        correctOptionIndex: item.correctOptionIndex,
      })),
    );
  });

  return getAdminPracticeItems(articleId);
}

export async function getLearnPractice(userId: string, articleId: string): Promise<LearnPracticeData> {
  const article = await requirePublishedArticle(articleId);
  const rows = await listPracticeItemRows(articleId);
  const attempt = await findInProgressAttempt(userId, articleId);

  return {
    articleId: article.id,
    articleTitle: article.title,
    items: rows.map(toLearnerItem),
    attempt: attempt ? toAttempt(attempt) : null,
  };
}

export async function startOrResumePracticeAttempt(userId: string, articleId: string): Promise<PracticeAttempt> {
  await requirePublishedArticle(articleId);
  const itemCount = await countPracticeItems(articleId);
  if (itemCount < 1) {
    throw new NotFoundError('Practice');
  }

  const existing = await findInProgressAttempt(userId, articleId);
  if (existing) {
    return toAttempt(existing);
  }

  const [created] = await db
    .insert(practiceAttemptTable)
    .values({
      id: randomUUID(),
      userId,
      articleId,
      status: 'in_progress',
      currentIndex: 0,
      answers: [],
      startedAt: new Date(),
      finishedAt: null,
    })
    .returning();

  if (!created) {
    throw new AppError(500, 'Failed to start practice attempt');
  }
  return toAttempt(created);
}

function mergeAnswers(existing: PracticeAttemptAnswer[], incoming: PracticeAttemptAnswer[]): DbPracticeAttemptAnswer[] {
  const map = new Map<string, number>();
  for (const answer of existing) {
    map.set(answer.practiceItemId, answer.selectedOptionIndex);
  }
  for (const answer of incoming) {
    map.set(answer.practiceItemId, answer.selectedOptionIndex);
  }
  return [...map.entries()].map(([practiceItemId, selectedOptionIndex]) => ({
    practiceItemId,
    selectedOptionIndex,
  }));
}

export async function updatePracticeAttempt(
  userId: string,
  articleId: string,
  attemptId: string,
  input: UpdatePracticeAttemptBody,
): Promise<PracticeAttempt> {
  await requirePublishedArticle(articleId);

  const [attempt] = await db
    .select()
    .from(practiceAttemptTable)
    .where(
      and(
        eq(practiceAttemptTable.id, attemptId),
        eq(practiceAttemptTable.userId, userId),
        eq(practiceAttemptTable.articleId, articleId),
      ),
    )
    .limit(1);

  if (!attempt) {
    throw new NotFoundError('Practice attempt');
  }

  if (attempt.status !== 'in_progress' && input.status === undefined) {
    throw new ValidationFailedError([{ path: 'status', message: 'Finished attempts cannot be edited' }]);
  }

  if (attempt.status !== 'in_progress' && input.status !== undefined && input.status !== attempt.status) {
    throw new ValidationFailedError([{ path: 'status', message: 'Finished attempts cannot change status' }]);
  }

  const itemRows = await listPracticeItemRows(articleId);
  const itemIds = new Set(itemRows.map((row) => row.id));
  const optionCounts = new Map(itemRows.map((row) => [row.id, row.payload.options.length] as const));

  if (input.answers) {
    for (const [index, answer] of input.answers.entries()) {
      if (!itemIds.has(answer.practiceItemId)) {
        throw new ValidationFailedError([
          { path: `answers.${index}.practiceItemId`, message: 'Unknown practice item for this article' },
        ]);
      }
      const optionCount = optionCounts.get(answer.practiceItemId) ?? 0;
      if (answer.selectedOptionIndex >= optionCount) {
        throw new ValidationFailedError([
          { path: `answers.${index}.selectedOptionIndex`, message: 'selectedOptionIndex out of range' },
        ]);
      }
    }
  }

  if (input.currentIndex !== undefined && input.currentIndex > Math.max(itemRows.length - 1, 0)) {
    throw new ValidationFailedError([{ path: 'currentIndex', message: 'currentIndex out of range' }]);
  }

  const nextStatus = input.status ?? attempt.status;
  const now = new Date();
  const finishedAt = nextStatus === 'completed' || nextStatus === 'skipped' ? (attempt.finishedAt ?? now) : null;

  const [updated] = await db
    .update(practiceAttemptTable)
    .set({
      currentIndex: input.currentIndex ?? attempt.currentIndex,
      answers: input.answers ? mergeAnswers(attempt.answers, input.answers) : attempt.answers,
      status: nextStatus,
      finishedAt,
    })
    .where(eq(practiceAttemptTable.id, attempt.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Practice attempt');
  }
  return toAttempt(updated);
}
