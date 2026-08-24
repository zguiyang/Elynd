import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';

import {
  conversation as conversationTable,
  conversationMessage as conversationMessageTable,
  readingDay as readingDayTable,
  readingState as readingStateTable,
  readingWork as readingWorkTable,
} from '@gloaming/db';
import type {
  ReadingHistoryCompletion,
  ReadingHistoryData,
  ReadingHistorySummary,
} from '@gloaming/shared/api/reading-history';
import { calendarDateInTimeZone } from '@gloaming/shared/api/reading-history';

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

function consecutiveReadingDays(today: string, dates: ReadonlySet<string>): number {
  let countDays = 0;
  let cursor = today;
  while (dates.has(cursor)) {
    countDays += 1;
    cursor = addCalendarDays(cursor, -1);
  }
  return countDays;
}

async function insertReadingDays(userId: string, dates: Iterable<string>): Promise<void> {
  const unique = [...new Set(dates)];
  if (unique.length === 0) {
    return;
  }
  await db
    .insert(readingDayTable)
    .values(unique.map((localDate) => ({ id: randomUUID(), userId, localDate })))
    .onConflictDoNothing({ target: [readingDayTable.userId, readingDayTable.localDate] });
}

export async function touchReadingDay(userId: string, now = new Date()): Promise<void> {
  await insertReadingDays(userId, [calendarDateInTimeZone(now)]);
}

function pushShanghaiDates(target: Set<string>, ...values: Array<Date | null | undefined>): void {
  for (const value of values) {
    if (value) {
      target.add(calendarDateInTimeZone(value));
    }
  }
}

async function backfillReadingDays(userId: string): Promise<void> {
  const dates = new Set<string>();

  const stateRows = await db
    .select({
      createdAt: readingStateTable.createdAt,
      lastReadAt: readingStateTable.lastReadAt,
      completedAt: readingStateTable.completedAt,
    })
    .from(readingStateTable)
    .where(eq(readingStateTable.userId, userId));
  for (const row of stateRows) {
    pushShanghaiDates(dates, row.createdAt, row.lastReadAt, row.completedAt);
  }

  await insertReadingDays(userId, dates);
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

async function countCompletedWorks(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(readingStateTable)
    .where(and(eq(readingStateTable.userId, userId), eq(readingStateTable.status, 'completed')));
  return Number(row?.value ?? 0);
}

async function listActivityDates(userId: string): Promise<string[]> {
  const rows = await db
    .select({ localDate: readingDayTable.localDate })
    .from(readingDayTable)
    .where(eq(readingDayTable.userId, userId))
    .orderBy(asc(readingDayTable.localDate));
  return rows.map((row) => row.localDate);
}

async function listCompletions(userId: string): Promise<ReadingHistoryCompletion[]> {
  const rows = await db
    .select({
      completedAt: readingStateTable.completedAt,
      title: readingWorkTable.title,
      workId: readingWorkTable.id,
    })
    .from(readingStateTable)
    .innerJoin(readingWorkTable, eq(readingWorkTable.id, readingStateTable.workId))
    .where(
      and(
        eq(readingStateTable.userId, userId),
        eq(readingStateTable.status, 'completed'),
        isNotNull(readingStateTable.completedAt),
      ),
    )
    .orderBy(desc(readingStateTable.completedAt), asc(readingWorkTable.title));

  return rows.flatMap((row) => {
    if (!row.completedAt) {
      return [];
    }
    return [
      {
        date: calendarDateInTimeZone(row.completedAt),
        title: row.title,
        workId: row.workId,
      },
    ];
  });
}

export async function getReadingHistory(userId: string): Promise<ReadingHistoryData> {
  const today = calendarDateInTimeZone();
  await backfillReadingDays(userId);

  const activityDates = await listActivityDates(userId);
  const dateSet = new Set(activityDates);

  const portrait: ReadingHistorySummary = {
    consecutiveDays: consecutiveReadingDays(today, dateSet),
    readingDays: activityDates.length,
    completedWorks: await countCompletedWorks(userId),
    lookedUpWords: await countLookedUpWords(userId),
  };

  return {
    today,
    activity: activityDates.map((date) => ({ date, level: 1 as const })),
    completions: await listCompletions(userId),
    portrait,
  };
}
