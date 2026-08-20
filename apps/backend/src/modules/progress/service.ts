import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, exists, inArray, isNotNull, or, sql } from 'drizzle-orm';

import {
  article as articleTable,
  conversation as conversationTable,
  conversationMessage as conversationMessageTable,
  learnerDay as learnerDayTable,
  practiceAttempt as practiceAttemptTable,
  readingProgress as readingProgressTable,
  reviewSession as reviewSessionTable,
  reviewSessionItem as reviewSessionItemTable,
} from '@gloaming/db';
import type { ProgressCompletion, ProgressData, ProgressPortrait } from '@gloaming/shared/api/progress';
import { calendarDateInTimeZone } from '@gloaming/shared/api/review';

import { db } from '@/db';

function addCalendarDays(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function consecutiveLearningDays(today: string, dates: ReadonlySet<string>): number {
  let countDays = 0;
  let cursor = today;
  while (dates.has(cursor)) {
    countDays += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return countDays;
}

function interactedReviewFilter(userId: string) {
  return and(
    eq(reviewSessionTable.userId, userId),
    or(
      inArray(reviewSessionTable.outcome, ['completed', 'left']),
      exists(
        db
          .select({ id: reviewSessionItemTable.id })
          .from(reviewSessionItemTable)
          .where(
            and(
              eq(reviewSessionItemTable.sessionId, reviewSessionTable.id),
              isNotNull(reviewSessionItemTable.selectedIndex),
            ),
          ),
      ),
    ),
  );
}

async function insertLearnerDays(userId: string, dates: Iterable<string>): Promise<void> {
  const unique = [...new Set(dates)];
  if (unique.length === 0) {
    return;
  }
  await db
    .insert(learnerDayTable)
    .values(unique.map((localDate) => ({ id: randomUUID(), userId, localDate })))
    .onConflictDoNothing({ target: [learnerDayTable.userId, learnerDayTable.localDate] });
}

export async function touchLearnerDay(userId: string, now = new Date()): Promise<void> {
  await insertLearnerDays(userId, [calendarDateInTimeZone(now)]);
}

function pushShanghaiDates(target: Set<string>, ...values: Array<Date | null | undefined>): void {
  for (const value of values) {
    if (value) {
      target.add(calendarDateInTimeZone(value));
    }
  }
}

/** Reconstruct days from existing rows. Safe to call after touch (unique / onConflict). */
async function backfillLearnerDays(userId: string): Promise<void> {
  const dates = new Set<string>();

  const progressRows = await db
    .select({
      createdAt: readingProgressTable.createdAt,
      lastReadAt: readingProgressTable.lastReadAt,
      completedAt: readingProgressTable.completedAt,
    })
    .from(readingProgressTable)
    .where(eq(readingProgressTable.userId, userId));
  for (const row of progressRows) {
    pushShanghaiDates(dates, row.createdAt, row.lastReadAt, row.completedAt);
  }

  const attemptRows = await db
    .select({
      startedAt: practiceAttemptTable.startedAt,
      finishedAt: practiceAttemptTable.finishedAt,
    })
    .from(practiceAttemptTable)
    .where(eq(practiceAttemptTable.userId, userId));
  for (const row of attemptRows) {
    pushShanghaiDates(dates, row.startedAt, row.finishedAt);
  }

  const reviewRows = await db
    .select({ localDate: reviewSessionTable.localDate })
    .from(reviewSessionTable)
    .where(interactedReviewFilter(userId));
  for (const row of reviewRows) {
    dates.add(row.localDate);
  }

  await insertLearnerDays(userId, dates);
}

async function countLookedUpWords(userId: string): Promise<number> {
  const [row] = await db
    .select({
      value: sql<number>`coalesce(count(distinct lower(trim(${conversationMessageTable.metadata}->>'selection'))), 0)`,
    })
    .from(conversationMessageTable)
    .innerJoin(conversationTable, eq(conversationTable.id, conversationMessageTable.conversationId))
    .where(
      and(
        eq(conversationTable.userId, userId),
        eq(conversationMessageTable.role, 'user'),
        sql`${conversationMessageTable.metadata}->>'actionId' = 'lookup'`,
        sql`nullif(trim(${conversationMessageTable.metadata}->>'selection'), '') is not null`,
      ),
    );
  return Number(row?.value ?? 0);
}

async function countPracticeAnswers(userId: string): Promise<number> {
  const [row] = await db
    .select({
      value: sql<number>`coalesce(sum(jsonb_array_length(${practiceAttemptTable.answers})), 0)`,
    })
    .from(practiceAttemptTable)
    .where(eq(practiceAttemptTable.userId, userId));
  return Number(row?.value ?? 0);
}

async function countCompletedArticles(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(readingProgressTable)
    .where(and(eq(readingProgressTable.userId, userId), eq(readingProgressTable.status, 'completed')));
  return Number(row?.value ?? 0);
}

async function countInteractedReviews(userId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(reviewSessionTable).where(interactedReviewFilter(userId));
  return Number(row?.value ?? 0);
}

async function listActivityDates(userId: string): Promise<string[]> {
  const rows = await db
    .select({ localDate: learnerDayTable.localDate })
    .from(learnerDayTable)
    .where(eq(learnerDayTable.userId, userId))
    .orderBy(asc(learnerDayTable.localDate));
  return rows.map((row) => row.localDate);
}

async function listCompletions(userId: string): Promise<ProgressCompletion[]> {
  const rows = await db
    .select({
      completedAt: readingProgressTable.completedAt,
      title: articleTable.title,
      articleId: articleTable.id,
    })
    .from(readingProgressTable)
    .innerJoin(articleTable, eq(articleTable.id, readingProgressTable.articleId))
    .where(
      and(
        eq(readingProgressTable.userId, userId),
        eq(readingProgressTable.status, 'completed'),
        isNotNull(readingProgressTable.completedAt),
      ),
    )
    .orderBy(desc(readingProgressTable.completedAt), asc(articleTable.title));

  return rows.flatMap((row) => {
    if (!row.completedAt) {
      return [];
    }
    return [
      {
        date: calendarDateInTimeZone(row.completedAt),
        title: row.title,
        articleId: row.articleId,
      },
    ];
  });
}

export async function getProgress(userId: string): Promise<ProgressData> {
  const today = calendarDateInTimeZone();
  await backfillLearnerDays(userId);

  const activityDates = await listActivityDates(userId);
  const dateSet = new Set(activityDates);

  const portrait: ProgressPortrait = {
    consecutiveDays: consecutiveLearningDays(today, dateSet),
    learningDays: activityDates.length,
    completedArticles: await countCompletedArticles(userId),
    lookedUpWords: await countLookedUpWords(userId),
    reviewCount: await countInteractedReviews(userId),
    practiceCount: await countPracticeAnswers(userId),
  };

  return {
    today,
    activity: activityDates.map((date) => ({ date, level: 1 as const })),
    completions: await listCompletions(userId),
    portrait,
  };
}
