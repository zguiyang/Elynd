import { and, desc, eq, ne } from 'drizzle-orm';

import { readingState as readingStateTable, readingWork as readingWorkTable } from '@gloaming/db';
import { computeProgressRatio } from '@gloaming/shared/api/reader';
import { SHELF_ITEMS_LIMIT, type ShelfData } from '@gloaming/shared/api/shelf';

import { db } from '@/db';

type WorkRow = typeof readingWorkTable.$inferSelect;
type StateRow = typeof readingStateTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toWorkSummary(row: WorkRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    publishedAt: row.publishedAt ? toIso(row.publishedAt) : null,
  };
}

function toState(row: StateRow) {
  return {
    status: row.status as 'in_progress' | 'completed',
    currentPartId: row.currentPartId,
    progressRatio: computeProgressRatio({
      status: row.status as 'in_progress' | 'completed',
      anchorKind: row.anchorKind,
      anchorValue: row.anchorValue,
    }),
    lastReadAt: toIso(row.lastReadAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
  };
}

/** My shelf: latest in-progress as continue hero; remaining state rows as grid. */
export async function getShelf(userId: string): Promise<ShelfData> {
  const [currentRow] = await db
    .select({
      state: readingStateTable,
      work: readingWorkTable,
    })
    .from(readingStateTable)
    .innerJoin(readingWorkTable, eq(readingStateTable.workId, readingWorkTable.id))
    .where(
      and(
        eq(readingStateTable.userId, userId),
        eq(readingStateTable.status, 'in_progress'),
        eq(readingWorkTable.status, 'published'),
      ),
    )
    .orderBy(desc(readingStateTable.lastReadAt), desc(readingStateTable.id))
    .limit(1);

  const itemConditions = [
    eq(readingStateTable.userId, userId),
    eq(readingWorkTable.status, 'published'),
    ...(currentRow ? [ne(readingStateTable.id, currentRow.state.id)] : []),
  ];

  const itemRows = await db
    .select({
      state: readingStateTable,
      work: readingWorkTable,
    })
    .from(readingStateTable)
    .innerJoin(readingWorkTable, eq(readingStateTable.workId, readingWorkTable.id))
    .where(and(...itemConditions))
    .orderBy(desc(readingStateTable.lastReadAt), desc(readingStateTable.id))
    .limit(SHELF_ITEMS_LIMIT);

  return {
    current: currentRow ? { work: toWorkSummary(currentRow.work), state: toState(currentRow.state) } : null,
    items: itemRows.map((row) => ({
      work: toWorkSummary(row.work),
      state: toState(row.state),
    })),
  };
}
