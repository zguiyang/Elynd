import { and, desc, eq, ne } from 'drizzle-orm';

import { article as articleTable, readingProgress as readingProgressTable } from '@gloaming/db';
import { type ReaderItemSummary } from '@gloaming/shared/api/reader';
import { SHELF_ITEMS_LIMIT, type ShelfData } from '@gloaming/shared/api/shelf';

import { db } from '@/db';

type ArticleRow = typeof articleTable.$inferSelect;
type ProgressRow = typeof readingProgressTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toSummary(row: ArticleRow): ReaderItemSummary {
  return {
    id: row.id,
    title: row.title,
    level: row.level as ReaderItemSummary['level'],
    themes: row.themes,
    estimatedMinutes: row.estimatedMinutes,
  };
}

function toProgress(row: ProgressRow) {
  return {
    status: row.status as 'in_progress' | 'completed',
    progressRatio: row.progressRatio,
    lastReadAt: toIso(row.lastReadAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
  };
}

/** My shelf: latest in-progress as continue hero; remaining progress rows as grid. */
export async function getShelf(userId: string): Promise<ShelfData> {
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
    .limit(SHELF_ITEMS_LIMIT);

  return {
    current: currentRow ? { article: toSummary(currentRow.article), progress: toProgress(currentRow.progress) } : null,
    items: itemRows.map((row) => ({
      article: toSummary(row.article),
      progress: toProgress(row.progress),
    })),
  };
}
