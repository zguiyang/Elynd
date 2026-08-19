import { randomInt, randomUUID } from 'node:crypto';

import { and, asc, eq, isNotNull, max } from 'drizzle-orm';
import { z } from 'zod';

import {
  article as articleTable,
  readingProgress as readingProgressTable,
  reviewItem as reviewItemTable,
  reviewSession as reviewSessionTable,
  reviewSessionItem as reviewSessionItemTable,
} from '@elynd/db';
import {
  type AdminReviewItemsData,
  calendarDateInTimeZone,
  type GenerateReviewItemsResponse,
  generateReviewItemsResponseSchema,
  type LearnerReviewQueueItem,
  type ReplaceReviewItemsBody,
  REVIEW_FOCUS_MAX,
  REVIEW_HINT_MAX,
  REVIEW_ITEM_KINDS,
  REVIEW_ITEMS_MAX,
  REVIEW_OPTION_MAX,
  REVIEW_OPTIONS_MAX,
  REVIEW_SENTENCE_MAX,
  type ReviewAnswerResponse,
  type ReviewFeedbackResponse,
  reviewFeedbackResponseSchema,
  type ReviewItemKind,
  type ReviewItemWrite,
  type ReviewLeaveResponse,
  type ReviewQueueStatus,
  type ReviewSessionOutcome,
  type ReviewSessionResult,
  type ReviewSessionSource,
  type ReviewTodayData,
} from '@elynd/shared/api/review';

import { db } from '@/db';
import { AppError, NotFoundError, ValidationFailedError } from '@/lib/errors';
import { composePromptMessages, PROMPT_ROLE, PROMPT_SCENE } from '@/lib/prompts';
import { invokeAi } from '@/modules/ai';
import { touchLearnerDay } from '@/modules/progress/service';
import { pickDailyReviewItems } from '@/modules/review/pick';

type ArticleRow = typeof articleTable.$inferSelect;
type ReviewItemRow = typeof reviewItemTable.$inferSelect;
type ReviewSessionRow = typeof reviewSessionTable.$inferSelect;
type ReviewSessionItemRow = typeof reviewSessionItemTable.$inferSelect;

type PoolRow = ReviewItemRow & {
  articleTitle: string;
  articleBody: string;
};

function paragraphsFromBody(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function asKind(kind: string): ReviewItemKind {
  if ((REVIEW_ITEM_KINDS as readonly string[]).includes(kind)) {
    return kind as ReviewItemKind;
  }
  throw new AppError(500, 'Invalid review item kind');
}

function asOutcome(outcome: string): ReviewSessionOutcome {
  if (outcome === 'in_progress' || outcome === 'completed' || outcome === 'left') {
    return outcome;
  }
  throw new AppError(500, 'Invalid review session outcome');
}

function toAdminItem(row: ReviewItemRow) {
  return {
    id: row.id,
    kind: asKind(row.kind),
    sentence: row.sentence,
    focus: row.focus,
    options: row.options,
    hintZh: row.hintZh,
    correctOptionIndex: row.correctOptionIndex,
    sortOrder: row.sortOrder,
  };
}

function toLearnerQueueItem(row: ReviewSessionItemRow): LearnerReviewQueueItem {
  return {
    id: row.id,
    kind: asKind(row.kind),
    sentence: row.sentence,
    focus: row.focus,
    options: row.options,
    hintZh: row.hintZh,
    articleId: row.articleId,
    articleTitle: row.articleTitle,
    paragraphs: paragraphsFromBody(row.articleBody),
    selectedIndex: row.selectedIndex ?? null,
  };
}

function missHint(options: string[], correctIndex: number, selectedIndex: number, focus: string): string | null {
  if (selectedIndex === correctIndex) {
    return null;
  }
  const picked = options[selectedIndex] ?? '';
  const correct = options[correctIndex] ?? focus;
  return `是「${correct}」，不是「${picked}」。`;
}

async function requireArticleExists(articleId: string): Promise<ArticleRow> {
  const [row] = await db.select().from(articleTable).where(eq(articleTable.id, articleId)).limit(1);
  if (!row) {
    throw new NotFoundError('Article');
  }
  return row;
}

async function listReviewItemRows(articleId: string): Promise<ReviewItemRow[]> {
  return db
    .select()
    .from(reviewItemTable)
    .where(eq(reviewItemTable.articleId, articleId))
    .orderBy(asc(reviewItemTable.sortOrder), asc(reviewItemTable.id));
}

async function countCompletedArticles(userId: string): Promise<number> {
  const rows = await db
    .select({ articleId: readingProgressTable.articleId })
    .from(readingProgressTable)
    .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.status, 'completed')));
  return rows.length;
}

async function findTodaySession(userId: string, date: string): Promise<ReviewSessionRow | null> {
  const [row] = await db
    .select()
    .from(reviewSessionTable)
    .where(and(eq(reviewSessionTable.userId, userId), eq(reviewSessionTable.localDate, date)))
    .limit(1);
  return row ?? null;
}

async function reopenLeftSession(session: ReviewSessionRow): Promise<ReviewSessionRow> {
  if (asOutcome(session.outcome) !== 'left') {
    return session;
  }
  await db
    .update(reviewSessionTable)
    .set({ outcome: 'in_progress', updatedAt: new Date() })
    .where(eq(reviewSessionTable.id, session.id));
  return { ...session, outcome: 'in_progress' };
}

async function listSessionItems(sessionId: string): Promise<ReviewSessionItemRow[]> {
  return db
    .select()
    .from(reviewSessionItemTable)
    .where(eq(reviewSessionItemTable.sessionId, sessionId))
    .orderBy(asc(reviewSessionItemTable.sortOrder), asc(reviewSessionItemTable.id));
}

function emptyToday(
  queueStatus: Extract<ReviewQueueStatus, 'need_completion' | 'empty'>,
  date: string,
): ReviewTodayData {
  return { queueStatus, date, outcome: null, items: [], result: null };
}

function buildSessionResult(rows: ReviewSessionItemRow[]): ReviewSessionResult {
  const items = rows.map((row) => {
    const selectedOptionIndex = row.selectedIndex ?? null;
    return {
      id: row.id,
      kind: asKind(row.kind),
      label: row.focus,
      sentence: row.sentence,
      options: row.options,
      selectedOptionIndex,
      correctOptionIndex: row.correctOptionIndex,
      isCorrect: selectedOptionIndex === row.correctOptionIndex,
    };
  });
  return {
    correctCount: items.filter((item) => item.isCorrect).length,
    totalCount: items.length,
    items,
  };
}

export async function getAdminReviewItems(articleId: string): Promise<AdminReviewItemsData> {
  await requireArticleExists(articleId);
  const rows = await listReviewItemRows(articleId);
  return { items: rows.map(toAdminItem) };
}

export async function replaceAdminReviewItems(
  articleId: string,
  body: ReplaceReviewItemsBody,
): Promise<AdminReviewItemsData> {
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
    await tx.delete(reviewItemTable).where(eq(reviewItemTable.articleId, articleId));
    if (items.length === 0) {
      return;
    }
    await tx.insert(reviewItemTable).values(
      items.map((item) => ({
        id: randomUUID(),
        articleId,
        sortOrder: item.sortOrder,
        kind: item.kind,
        sentence: item.sentence,
        focus: item.focus,
        options: item.options,
        hintZh: item.hintZh,
        correctOptionIndex: item.correctOptionIndex,
      })),
    );
  });

  return getAdminReviewItems(articleId);
}

const reviewGenerateLlmSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).min(1),
});

function shuffleReviewOptions(
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

function clipText(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max).trim();
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function parseReviewKind(value: unknown): ReviewItemKind | null {
  return value === 'cloze' || value === 'sense' ? value : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean);
}

function capOptions(
  options: string[],
  correctIndex: number,
  max: number,
): { options: string[]; correctOptionIndex: number } {
  if (options.length <= max) {
    return { options, correctOptionIndex: Math.min(Math.max(correctIndex, 0), options.length - 1) };
  }
  const safeCorrect = Math.min(Math.max(correctIndex, 0), options.length - 1);
  const correct = options[safeCorrect]!;
  const rest = options.filter((_, index) => index !== safeCorrect).slice(0, max - 1);
  return { options: [...rest, correct], correctOptionIndex: rest.length };
}

function mapLlmReviewItems(rawItems: Record<string, unknown>[]): ReviewItemWrite[] {
  const mapped: ReviewItemWrite[] = [];
  for (const raw of rawItems) {
    const kind = parseReviewKind(raw.kind);
    const sentence = clipText(pickText(raw.sentence), REVIEW_SENTENCE_MAX);
    const focus = clipText(pickText(raw.focus), REVIEW_FOCUS_MAX);
    const hintZh = clipText(pickText(raw.hintZh, raw.hint), REVIEW_HINT_MAX);
    const optionTexts = asStringList(raw.options).map((option) => clipText(option, REVIEW_OPTION_MAX));
    const correct = asInt(raw.correctOptionIndex) ?? asInt(raw.correctIndex);
    if (!kind || !sentence || !focus || !hintZh || optionTexts.length < 2 || correct == null) {
      continue;
    }
    const capped = capOptions(optionTexts, correct, REVIEW_OPTIONS_MAX);
    const shuffled = shuffleReviewOptions(capped.options, capped.correctOptionIndex);
    mapped.push({
      kind,
      sentence,
      focus,
      options: shuffled.options,
      hintZh,
      correctOptionIndex: shuffled.correctOptionIndex,
      sortOrder: mapped.length + 1,
    });
    if (mapped.length >= REVIEW_ITEMS_MAX) {
      break;
    }
  }
  return mapped;
}

function parseReviewGenerateJson(raw: string): z.infer<typeof reviewGenerateLlmSchema> {
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
  const checked = reviewGenerateLlmSchema.safeParse(parsed);
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

export async function generateAdminReviewItems(
  articleId: string,
  userId: string,
): Promise<GenerateReviewItemsResponse> {
  const article = await requireArticleExists(articleId);
  if (!article.title.trim() || !article.body.trim()) {
    throw new ValidationFailedError([
      { path: 'body', message: 'Article title and body are required to generate review items' },
    ]);
  }

  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.reviewGenerate,
    actionId: 'generate',
    vars: {
      articleTitle: article.title,
      articleBody: article.body,
      articleLevel: article.level,
    },
  });

  const result = await invokeAi({
    purpose: 'practice',
    source: 'review.generate',
    userId,
    ref: { type: 'article', id: article.id },
    messages,
    timeoutMs: 60_000,
    thinking: 'disabled',
    requestSummaryExtra: { articleLevel: article.level },
  });

  const llmPayload = parseReviewGenerateJson(result.content);
  const parsed = generateReviewItemsResponseSchema.safeParse({
    items: mapLlmReviewItems(llmPayload.items),
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

async function listEligibleUserIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: readingProgressTable.userId })
    .from(readingProgressTable)
    .where(eq(readingProgressTable.status, 'completed'));
  return rows.map((row) => row.userId);
}

async function loadPoolForUser(userId: string): Promise<PoolRow[]> {
  return db
    .select({
      id: reviewItemTable.id,
      articleId: reviewItemTable.articleId,
      sortOrder: reviewItemTable.sortOrder,
      kind: reviewItemTable.kind,
      sentence: reviewItemTable.sentence,
      focus: reviewItemTable.focus,
      options: reviewItemTable.options,
      hintZh: reviewItemTable.hintZh,
      correctOptionIndex: reviewItemTable.correctOptionIndex,
      createdAt: reviewItemTable.createdAt,
      updatedAt: reviewItemTable.updatedAt,
      articleTitle: articleTable.title,
      articleBody: articleTable.body,
    })
    .from(reviewItemTable)
    .innerJoin(articleTable, eq(articleTable.id, reviewItemTable.articleId))
    .innerJoin(
      readingProgressTable,
      and(
        eq(readingProgressTable.articleId, articleTable.id),
        eq(readingProgressTable.userId, userId),
        eq(readingProgressTable.status, 'completed'),
      ),
    )
    .where(eq(articleTable.status, 'published'));
}

async function loadLastAppearedMap(userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      reviewItemId: reviewSessionItemTable.reviewItemId,
      lastAppearedOn: max(reviewSessionTable.localDate),
    })
    .from(reviewSessionItemTable)
    .innerJoin(reviewSessionTable, eq(reviewSessionTable.id, reviewSessionItemTable.sessionId))
    .where(and(eq(reviewSessionTable.userId, userId), isNotNull(reviewSessionItemTable.reviewItemId)))
    .groupBy(reviewSessionItemTable.reviewItemId);

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.reviewItemId && row.lastAppearedOn) {
      map.set(row.reviewItemId, row.lastAppearedOn);
    }
  }
  return map;
}

async function writeUserSession(
  userId: string,
  date: string,
  source: ReviewSessionSource,
  picked: PoolRow[],
): Promise<boolean> {
  if (picked.length === 0) {
    return false;
  }

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(reviewSessionTable)
      .values({
        id: randomUUID(),
        userId,
        localDate: date,
        source,
        outcome: 'in_progress',
      })
      .onConflictDoNothing()
      .returning({ id: reviewSessionTable.id });

    const sessionId = inserted[0]?.id;
    if (!sessionId) {
      return false;
    }

    await tx.insert(reviewSessionItemTable).values(
      picked.map((item, index) => ({
        id: randomUUID(),
        sessionId,
        reviewItemId: item.id,
        sortOrder: index + 1,
        articleId: item.articleId,
        articleTitle: item.articleTitle,
        articleBody: item.articleBody,
        kind: item.kind,
        sentence: item.sentence,
        focus: item.focus,
        options: item.options,
        hintZh: item.hintZh,
        correctOptionIndex: item.correctOptionIndex,
      })),
    );
    return true;
  });
}

export async function materializeDailyReview(input: {
  mode: ReviewSessionSource;
  date?: string;
}): Promise<{ date: string; users: number }> {
  const date = input.date ?? calendarDateInTimeZone();

  if (input.mode === 'manual') {
    await db.delete(reviewSessionTable).where(eq(reviewSessionTable.localDate, date));
  }

  const userIds = await listEligibleUserIds();
  let users = 0;

  for (const userId of userIds) {
    const wrote = await assembleUserTodaySession(userId, date, input.mode);
    if (wrote) {
      users += 1;
    }
  }

  return { date, users };
}

async function assembleUserTodaySession(userId: string, date: string, source: ReviewSessionSource): Promise<boolean> {
  if (await findTodaySession(userId, date)) {
    return false;
  }

  const pool = await loadPoolForUser(userId);
  const lastAppeared = await loadLastAppearedMap(userId);
  const picked = pickDailyReviewItems(
    pool.map((item) => ({
      ...item,
      lastAppearedOn: lastAppeared.get(item.id) ?? null,
    })),
  );
  return writeUserSession(userId, date, source, picked);
}

export async function getReviewToday(userId: string): Promise<ReviewTodayData> {
  await touchLearnerDay(userId);
  const date = calendarDateInTimeZone();
  const completedCount = await countCompletedArticles(userId);
  if (completedCount === 0) {
    return emptyToday('need_completion', date);
  }

  await assembleUserTodaySession(userId, date, 'cron');
  const found = await findTodaySession(userId, date);
  if (!found) {
    return emptyToday('empty', date);
  }
  const session = await reopenLeftSession(found);

  const rows = await listSessionItems(session.id);
  const outcome = asOutcome(session.outcome);
  const queueStatus: ReviewQueueStatus = outcome === 'in_progress' ? 'ready' : 'done';

  return {
    queueStatus,
    date,
    outcome,
    items: rows.map(toLearnerQueueItem),
    result: outcome === 'completed' ? buildSessionResult(rows) : null,
  };
}

export async function answerReviewToday(
  userId: string,
  body: { itemId: string; selectedIndex: number },
): Promise<ReviewAnswerResponse> {
  const date = calendarDateInTimeZone();
  const found = await findTodaySession(userId, date);
  if (!found) {
    throw new NotFoundError('Review session');
  }
  const session = await reopenLeftSession(found);
  if (asOutcome(session.outcome) !== 'in_progress') {
    throw new NotFoundError('Review session');
  }

  const [item] = await db
    .select()
    .from(reviewSessionItemTable)
    .where(and(eq(reviewSessionItemTable.id, body.itemId), eq(reviewSessionItemTable.sessionId, session.id)))
    .limit(1);
  if (!item) {
    throw new NotFoundError('Review item');
  }
  if (body.selectedIndex >= item.options.length) {
    throw new ValidationFailedError([
      { path: 'selectedIndex', message: 'selectedIndex must be a valid options index' },
    ]);
  }

  const selectedIndex = item.selectedIndex ?? body.selectedIndex;
  if (item.selectedIndex == null) {
    await db
      .update(reviewSessionItemTable)
      .set({ selectedIndex: body.selectedIndex, updatedAt: new Date() })
      .where(eq(reviewSessionItemTable.id, item.id));
  }

  const items = await listSessionItems(session.id);
  const allAnswered = items.every((row) => row.selectedIndex != null);
  let queueStatus: ReviewQueueStatus = 'ready';
  if (allAnswered) {
    await db
      .update(reviewSessionTable)
      .set({ outcome: 'completed', updatedAt: new Date() })
      .where(eq(reviewSessionTable.id, session.id));
    queueStatus = 'done';
  }

  const isHit = selectedIndex === item.correctOptionIndex;
  return {
    isHit,
    hint: missHint(item.options, item.correctOptionIndex, selectedIndex, item.focus),
    correctIndex: item.correctOptionIndex,
    queueStatus,
    result: queueStatus === 'done' ? buildSessionResult(items) : null,
  };
}

export async function leaveReviewToday(userId: string): Promise<ReviewLeaveResponse> {
  const date = calendarDateInTimeZone();
  const session = await findTodaySession(userId, date);
  if (!session) {
    throw new NotFoundError('Review session');
  }

  if (asOutcome(session.outcome) === 'in_progress') {
    await db
      .update(reviewSessionTable)
      .set({ outcome: 'left', updatedAt: new Date() })
      .where(eq(reviewSessionTable.id, session.id));
  }

  return { queueStatus: 'done' };
}

const reviewFeedbackLlmSchema = z.object({
  advice: z.string().min(1).max(500),
});

function formatReviewDetailForPrompt(result: ReviewSessionResult): string {
  return result.items
    .map((item, index) => {
      const selected = item.selectedOptionIndex == null ? '未作答' : (item.options[item.selectedOptionIndex] ?? '');
      const correct = item.options[item.correctOptionIndex] ?? '';
      return [
        `${index + 1}. [${item.kind}] ${item.label} — ${item.sentence}`,
        `   result: ${item.isCorrect ? 'correct' : 'incorrect'}`,
        `   selected: ${selected}`,
        `   correct: ${correct}`,
      ].join('\n');
    })
    .join('\n');
}

function parseReviewFeedbackJson(raw: string): z.infer<typeof reviewFeedbackLlmSchema> {
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
  const checked = reviewFeedbackLlmSchema.safeParse(parsed);
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

export async function getReviewTodayFeedback(userId: string): Promise<ReviewFeedbackResponse> {
  const today = await getReviewToday(userId);
  if (today.outcome !== 'completed' || !today.result) {
    throw new ValidationFailedError([{ path: 'status', message: 'Feedback is only available after completing today' }]);
  }

  const titles = [...new Set(today.items.map((item) => item.articleTitle).filter(Boolean))];
  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.reviewFeedback,
    actionId: 'advise',
    vars: {
      articleTitles: titles.join('；') || '今日复习',
      correctCount: String(today.result.correctCount),
      totalCount: String(today.result.totalCount),
      attemptDetail: formatReviewDetailForPrompt(today.result),
    },
  });

  const aiResult = await invokeAi({
    purpose: 'practiceFeedback',
    source: 'review.feedback',
    userId,
    messages,
    timeoutMs: 45_000,
    thinking: 'disabled',
    requestSummaryExtra: {
      correctCount: today.result.correctCount,
      totalCount: today.result.totalCount,
    },
  });

  return reviewFeedbackResponseSchema.parse(parseReviewFeedbackJson(aiResult.content));
}
