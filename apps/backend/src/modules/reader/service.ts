import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { readingPart as readingPartTable } from '@gloaming/db';
import { readingState as readingStateTable } from '@gloaming/db';
import {
  computeChapterProgress,
  NO_CHAPTERS_COMPLETED,
  type ReaderPartData,
  type ReaderPartsData,
  type ReadingState,
  type UpdateReadingStateBody,
} from '@gloaming/shared/api/reader';
import { estimatedMinutesFromWordCount } from '@gloaming/shared/api/reading-stats';

import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { getPartAudioAvailability, getPublishedPartAudioTrack } from '@/modules/content-assets/service';
import { reindexLeafParagraphOrdinals } from '@/modules/epub-ingest/clean';
import { touchReadingDay } from '@/modules/reading-history/service';
import { getPartById, loadTagsForWork, requirePublishedWorkWithParts } from '@/modules/works/service';

type StateRow = typeof readingStateTable.$inferSelect;
type PartRow = typeof readingPartTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function sortedParts(parts: PartRow[]): PartRow[] {
  return [...parts].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function toPartSummary(part: PartRow) {
  const meta = part.meta as { wordCount?: unknown };
  const wordCount = typeof meta.wordCount === 'number' ? meta.wordCount : null;
  return {
    id: part.id,
    workId: part.workId,
    sortOrder: part.sortOrder,
    kind: part.kind as ReaderPartsData['parts'][number]['kind'],
    title: part.title,
    wordCount,
    estimatedMinutes: wordCount != null ? estimatedMinutesFromWordCount(wordCount) : null,
    createdAt: toIso(part.createdAt),
    updatedAt: toIso(part.updatedAt),
  };
}

function toWorkSummary(
  work: Awaited<ReturnType<typeof requirePublishedWorkWithParts>>['work'],
  tags: string[],
): ReaderPartsData['work'] {
  return {
    id: work.id,
    title: work.title,
    description: work.description,
    tags,
    coverAssetId: work.coverAssetId,
    publishedAt: work.publishedAt ? toIso(work.publishedAt) : null,
  };
}

function toReadingState(row: StateRow, parts: PartRow[]): ReadingState {
  const partSortOrders = sortedParts(parts).map((part) => ({ sortOrder: part.sortOrder }));
  const completedThrough = row.completedThroughSortOrder ?? NO_CHAPTERS_COMPLETED;
  return {
    status: row.status as ReadingState['status'],
    currentPartId: row.currentPartId,
    completedThroughSortOrder: completedThrough,
    progressRatio: computeChapterProgress({
      status: row.status as ReadingState['status'],
      completedThroughSortOrder: completedThrough,
      parts: partSortOrders,
    }),
    totalPartCount: parts.length,
    lastReadAt: toIso(row.lastReadAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
  };
}

function findPart(parts: PartRow[], partId: string): PartRow {
  const part = parts.find((row) => row.id === partId);
  if (!part) {
    throw new NotFoundError('Part');
  }
  return part;
}

function nextPartAfter(parts: PartRow[], current: PartRow): PartRow | null {
  const ordered = sortedParts(parts);
  const index = ordered.findIndex((part) => part.id === current.id);
  if (index < 0 || index >= ordered.length - 1) {
    return null;
  }
  return ordered[index + 1] ?? null;
}

function maxCompletedThrough(current: number, candidate: number): number {
  return Math.max(current, candidate);
}

export async function getReaderParts(workId: string): Promise<ReaderPartsData> {
  const { work, parts } = await requirePublishedWorkWithParts(workId);
  const tags = await loadTagsForWork(workId);
  return {
    work: toWorkSummary(work, tags),
    parts: sortedParts(parts).map(toPartSummary),
  };
}

export async function getReaderPart(partId: string): Promise<ReaderPartData> {
  const part = await getPartById(partId);
  const { work, parts } = await requirePublishedWorkWithParts(part.workId);
  if (!parts.some((row) => row.id === partId)) {
    throw new NotFoundError('Part');
  }
  const tags = await loadTagsForWork(work.id);
  const audioAvailable = await getPartAudioAvailability(part.id, part.title, part.body);
  return {
    work: {
      id: work.id,
      title: work.title,
      coverAssetId: work.coverAssetId,
      tags,
    },
    part: {
      id: part.id,
      workId: part.workId,
      sortOrder: part.sortOrder,
      kind: part.kind as ReaderPartData['part']['kind'],
      title: part.title,
      body: reindexLeafParagraphOrdinals(part.body),
    },
    audioAvailable,
  };
}

export async function getReadingState(userId: string, workId: string): Promise<ReadingState | null> {
  const { parts } = await requirePublishedWorkWithParts(workId);
  const [row] = await db
    .select()
    .from(readingStateTable)
    .where(and(eq(readingStateTable.userId, userId), eq(readingStateTable.workId, workId)))
    .limit(1);
  if (!row) {
    return null;
  }
  return toReadingState(row, parts);
}

async function loadStateRow(userId: string, workId: string): Promise<StateRow | null> {
  const [row] = await db
    .select()
    .from(readingStateTable)
    .where(and(eq(readingStateTable.userId, userId), eq(readingStateTable.workId, workId)))
    .limit(1);
  return row ?? null;
}

export async function updateReadingState(
  userId: string,
  workId: string,
  input: UpdateReadingStateBody,
): Promise<ReadingState> {
  const { parts } = await requirePublishedWorkWithParts(workId);
  const ordered = sortedParts(parts);
  const firstPart = ordered[0]!;
  const now = new Date();
  const existing = await loadStateRow(userId, workId);

  const resolvePartId = (preferred?: string | null): string => {
    if (preferred && parts.some((part) => part.id === preferred)) {
      return preferred;
    }
    if (existing?.currentPartId && parts.some((part) => part.id === existing.currentPartId)) {
      return existing.currentPartId;
    }
    return firstPart.id;
  };

  if (input.action === 'add_to_shelf') {
    if (existing) {
      await touchReadingDay(userId);
      return toReadingState(existing, parts);
    }
    const [created] = await db
      .insert(readingStateTable)
      .values({
        id: randomUUID(),
        userId,
        workId,
        currentPartId: firstPart.id,
        completedThroughSortOrder: NO_CHAPTERS_COMPLETED,
        status: 'in_progress',
        addedAt: now,
        lastReadAt: now,
        completedAt: null,
      })
      .returning();
    if (!created) {
      throw new AppError(500, 'Failed to create reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(created, parts);
  }

  if (input.action === 'open') {
    const partId = resolvePartId(input.partId);
    if (!existing) {
      const [created] = await db
        .insert(readingStateTable)
        .values({
          id: randomUUID(),
          userId,
          workId,
          currentPartId: partId,
          completedThroughSortOrder: NO_CHAPTERS_COMPLETED,
          status: 'in_progress',
          addedAt: now,
          lastReadAt: now,
          completedAt: null,
        })
        .returning();
      if (!created) {
        throw new AppError(500, 'Failed to create reading state');
      }
      await touchReadingDay(userId);
      return toReadingState(created, parts);
    }
    const [updated] = await db
      .update(readingStateTable)
      .set({ currentPartId: partId, lastReadAt: now })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new NotFoundError('Reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(updated, parts);
  }

  if (input.action === 'restart') {
    if (!existing) {
      const [created] = await db
        .insert(readingStateTable)
        .values({
          id: randomUUID(),
          userId,
          workId,
          currentPartId: firstPart.id,
          completedThroughSortOrder: NO_CHAPTERS_COMPLETED,
          status: 'in_progress',
          addedAt: now,
          lastReadAt: now,
          completedAt: null,
        })
        .returning();
      if (!created) {
        throw new AppError(500, 'Failed to create reading state');
      }
      await touchReadingDay(userId);
      return toReadingState(created, parts);
    }
    const [updated] = await db
      .update(readingStateTable)
      .set({
        status: 'in_progress',
        currentPartId: firstPart.id,
        completedThroughSortOrder: NO_CHAPTERS_COMPLETED,
        completedAt: null,
        lastReadAt: now,
      })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new NotFoundError('Reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(updated, parts);
  }

  if (!existing) {
    throw new NotFoundError('Reading state');
  }

  if (input.action === 'complete_chapter') {
    const current = existing.currentPartId ? findPart(parts, existing.currentPartId) : firstPart;
    const completedThrough = maxCompletedThrough(
      existing.completedThroughSortOrder ?? NO_CHAPTERS_COMPLETED,
      current.sortOrder,
    );
    const next = input.nextPartId != null ? findPart(parts, input.nextPartId) : nextPartAfter(parts, current);
    if (!next) {
      throw new AppError(400, 'No next chapter — use finish to complete the book');
    }
    const [updated] = await db
      .update(readingStateTable)
      .set({
        currentPartId: next.id,
        completedThroughSortOrder: completedThrough,
        status: 'in_progress',
        lastReadAt: now,
      })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new NotFoundError('Reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(updated, parts);
  }

  if (input.action === 'navigate') {
    const target = findPart(parts, input.partId!);
    const current = existing.currentPartId ? findPart(parts, existing.currentPartId) : firstPart;
    let completedThrough = existing.completedThroughSortOrder ?? NO_CHAPTERS_COMPLETED;
    if (target.sortOrder > current.sortOrder) {
      completedThrough = maxCompletedThrough(completedThrough, target.sortOrder - 1);
    }
    const [updated] = await db
      .update(readingStateTable)
      .set({
        currentPartId: target.id,
        completedThroughSortOrder: completedThrough,
        status: 'in_progress',
        lastReadAt: now,
      })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new NotFoundError('Reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(updated, parts);
  }

  if (input.action === 'finish') {
    const maxSort = ordered[ordered.length - 1]!.sortOrder;
    const [updated] = await db
      .update(readingStateTable)
      .set({
        status: 'completed',
        completedThroughSortOrder: maxSort,
        completedAt: existing.completedAt ?? now,
        lastReadAt: now,
      })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    if (!updated) {
      throw new NotFoundError('Reading state');
    }
    await touchReadingDay(userId);
    return toReadingState(updated, parts);
  }

  throw new AppError(400, 'Unsupported action');
}

export { getPublishedPartAudioTrack, toReadingState };
