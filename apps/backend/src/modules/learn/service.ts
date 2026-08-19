import { randomInt, randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, notExists } from 'drizzle-orm';
import { z } from 'zod';

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
  type GeneratePracticeItemsResponse,
  generatePracticeItemsResponseSchema,
  LEARN_CONTINUE_READING_LIMIT,
  LEARN_TODAY_RECOMMENDATIONS_LIMIT,
  type LearnArticleData,
  type LearnArticleSummary,
  type LearnerPracticeItem,
  type LearnPracticeData,
  type LearnTodayData,
  type PracticeAttempt,
  type PracticeAttemptAnswer,
  type PracticeAttemptResult,
  type PracticeFeedbackResponse,
  practiceFeedbackResponseSchema,
  type PracticeItemKind,
  practiceOptionLetter,
  type ReplacePracticeItemsBody,
  type UpdatePracticeAttemptBody,
  type UpdatePracticeAttemptResponse,
  type UpdateReadingProgressBody,
} from '@elynd/shared/api/learn';

import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';
import { composePromptMessages, PROMPT_ROLE, PROMPT_SCENE } from '@/lib/prompts';
import { invokeAi } from '@/modules/ai';
import { getArticleAudioAvailability } from '@/modules/article-audio/service';
import { touchLearnerDay } from '@/modules/progress/service';

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

function practiceItemLabel(row: PracticeItemRow): string {
  if (row.kind === 'vocab' && 'word' in row.payload) {
    return row.payload.word;
  }
  if ('prompt' in row.payload) {
    return row.payload.prompt;
  }
  return '题目';
}

function buildPracticeAttemptResult(
  itemRows: PracticeItemRow[],
  answers: PracticeAttemptAnswer[],
): PracticeAttemptResult {
  const selectedByItem = new Map(answers.map((answer) => [answer.practiceItemId, answer.selectedOptionIndex]));
  const items = itemRows.map((row) => {
    const selectedOptionIndex = selectedByItem.get(row.id) ?? null;
    const isCorrect = selectedOptionIndex === row.correctOptionIndex;
    return {
      practiceItemId: row.id,
      kind: row.kind as PracticeItemKind,
      label: practiceItemLabel(row),
      options: row.payload.options,
      selectedOptionIndex,
      correctOptionIndex: row.correctOptionIndex,
      isCorrect,
    };
  });
  return {
    correctCount: items.filter((item) => item.isCorrect).length,
    totalCount: items.length,
    items,
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
    activePractice,
    recommendations: recommendationRows.map((row) => toSummary(row)),
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
    practiceAvailable,
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

/**
 * Flat LLM JSON shape (parsed from plain chat text — many gateways lack response_format).
 * Re-mapped and validated with generatePracticeItemsResponseSchema before return.
 */
const practiceGenerateLlmSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(['comprehension', 'vocab']),
        prompt: z.string().optional(),
        word: z.string().optional(),
        hint: z.string().optional(),
        quote: z.string().optional(),
        options: z.array(z.string()).min(2).max(6),
        correctOptionIndex: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(5),
});

function shufflePracticeOptions(
  options: string[],
  correctOptionIndex: number,
): {
  options: string[];
  correctOptionIndex: number;
} {
  const next = [...options];
  let correct = correctOptionIndex;
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    const atI = next[i]!;
    next[i] = next[j]!;
    next[j] = atI;
    if (correct === i) {
      correct = j;
    } else if (correct === j) {
      correct = i;
    }
  }
  return { options: next, correctOptionIndex: correct };
}

function mapLlmItemsToWriteShape(items: z.infer<typeof practiceGenerateLlmSchema>['items']) {
  return items.map((item, index) => {
    const shuffled = shufflePracticeOptions(item.options, item.correctOptionIndex);
    if (item.kind === 'vocab') {
      return {
        kind: 'vocab' as const,
        payload: {
          word: item.word ?? '',
          hint: item.hint ?? '',
          quote: item.quote ?? '',
          options: shuffled.options,
        },
        correctOptionIndex: shuffled.correctOptionIndex,
        sortOrder: index + 1,
      };
    }
    return {
      kind: 'comprehension' as const,
      payload: {
        prompt: item.prompt ?? '',
        options: shuffled.options,
      },
      correctOptionIndex: shuffled.correctOptionIndex,
      sortOrder: index + 1,
    };
  });
}

function parsePracticeGenerateJson(raw: string): z.infer<typeof practiceGenerateLlmSchema> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new ValidationFailedError([{ path: 'items', message: 'AI reply was not valid JSON' }]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    throw new ValidationFailedError([{ path: 'items', message: 'AI reply was not valid JSON' }]);
  }
  const checked = practiceGenerateLlmSchema.safeParse(parsed);
  if (!checked.success) {
    throw new ValidationFailedError(
      checked.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'items',
        message: issue.message,
      })),
    );
  }
  return checked.data;
}

/**
 * AI draft practice items for an article (admin). Does not write the database.
 * Uses plain chat JSON (not provider response_format) for OpenAI-compatible gateways.
 */
export async function generateAdminPracticeItems(
  articleId: string,
  userId: string,
): Promise<GeneratePracticeItemsResponse> {
  const article = await requireArticleExists(articleId);
  if (!article.title.trim() || !article.body.trim()) {
    throw new ValidationFailedError([
      { path: 'body', message: 'Article title and body are required to generate practice' },
    ]);
  }

  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.practiceGenerate,
    actionId: 'generate',
    vars: {
      articleTitle: article.title,
      articleBody: article.body,
      articleLevel: article.level,
    },
  });

  const result = await invokeAi({
    purpose: 'practice',
    source: 'practice.generate',
    userId,
    ref: { type: 'article', id: article.id },
    messages,
    timeoutMs: 60_000,
    thinking: 'disabled',
    requestSummaryExtra: { articleLevel: article.level },
  });

  const llmPayload = parsePracticeGenerateJson(result.content);
  const parsed = generatePracticeItemsResponseSchema.safeParse({
    items: mapLlmItemsToWriteShape(llmPayload.items),
  });
  if (!parsed.success) {
    throw new ValidationFailedError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'items',
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

export async function getLearnPractice(userId: string, articleId: string): Promise<LearnPracticeData> {
  const article = await requirePublishedArticle(articleId);
  const rows = await listPracticeItemRows(articleId);
  const attempt = await findInProgressAttempt(userId, articleId);
  await touchLearnerDay(userId);

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

  await touchLearnerDay(userId);

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
): Promise<UpdatePracticeAttemptResponse> {
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
  const nextAnswers = input.answers ? mergeAnswers(attempt.answers, input.answers) : attempt.answers;

  const [updated] = await db
    .update(practiceAttemptTable)
    .set({
      currentIndex: input.currentIndex ?? attempt.currentIndex,
      answers: nextAnswers,
      status: nextStatus,
      finishedAt,
    })
    .where(eq(practiceAttemptTable.id, attempt.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Practice attempt');
  }

  const base = toAttempt(updated);
  if (nextStatus !== 'completed') {
    return base;
  }

  return {
    ...base,
    result: buildPracticeAttemptResult(itemRows, nextAnswers as PracticeAttemptAnswer[]),
  };
}

const practiceFeedbackLlmSchema = z.object({
  advice: z.string().min(1).max(500),
});

function formatAttemptDetailForPrompt(result: PracticeAttemptResult): string {
  return result.items
    .map((item, index) => {
      const selected =
        item.selectedOptionIndex == null
          ? '未作答'
          : `${practiceOptionLetter(item.selectedOptionIndex)}. ${item.options[item.selectedOptionIndex] ?? ''}`;
      const correct = `${practiceOptionLetter(item.correctOptionIndex)}. ${item.options[item.correctOptionIndex] ?? ''}`;
      return [
        `${index + 1}. [${item.kind}] ${item.label}`,
        `   result: ${item.isCorrect ? 'correct' : 'incorrect'}`,
        `   selected: ${selected}`,
        `   correct: ${correct}`,
      ].join('\n');
    })
    .join('\n');
}

function parsePracticeFeedbackJson(raw: string): z.infer<typeof practiceFeedbackLlmSchema> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new ValidationFailedError([{ path: 'advice', message: 'AI reply was not valid JSON' }]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    throw new ValidationFailedError([{ path: 'advice', message: 'AI reply was not valid JSON' }]);
  }
  const checked = practiceFeedbackLlmSchema.safeParse(parsed);
  if (!checked.success) {
    throw new ValidationFailedError(
      checked.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'advice',
        message: issue.message,
      })),
    );
  }
  return checked.data;
}

/**
 * AI advice for a completed practice attempt. Does not persist advice.
 * Uses plain chat JSON (not provider response_format) for OpenAI-compatible gateways.
 */
export async function getPracticeAttemptFeedback(
  userId: string,
  articleId: string,
  attemptId: string,
): Promise<PracticeFeedbackResponse> {
  const article = await requirePublishedArticle(articleId);

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
  if (attempt.status !== 'completed') {
    throw new ValidationFailedError([{ path: 'status', message: 'Feedback is only available for completed attempts' }]);
  }

  const itemRows = await listPracticeItemRows(articleId);
  const result = buildPracticeAttemptResult(itemRows, attempt.answers as PracticeAttemptAnswer[]);

  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.practiceFeedback,
    actionId: 'advise',
    vars: {
      articleTitle: article.title,
      correctCount: String(result.correctCount),
      totalCount: String(result.totalCount),
      attemptDetail: formatAttemptDetailForPrompt(result),
    },
  });

  const aiResult = await invokeAi({
    purpose: 'practiceFeedback',
    source: 'practice.feedback',
    userId,
    ref: { type: 'practice_attempt', id: attempt.id },
    messages,
    timeoutMs: 45_000,
    thinking: 'disabled',
    requestSummaryExtra: {
      correctCount: result.correctCount,
      totalCount: result.totalCount,
    },
  });

  const llmPayload = parsePracticeFeedbackJson(aiResult.content);
  return practiceFeedbackResponseSchema.parse(llmPayload);
}
