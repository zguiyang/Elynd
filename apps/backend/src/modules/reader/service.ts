import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { readingPart as readingPartTable } from '@gloaming/db';
import { readingState as readingStateTable } from '@gloaming/db';
import { computeProgressRatio, type ReaderSessionData, type UpdateReadingStateBody } from '@gloaming/shared/api/reader';

import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { getPartAudioAvailability, getPublishedPartAudioTrack } from '@/modules/content-assets/service';
import { touchReadingDay } from '@/modules/reading-history/service';
import { loadTagsForWork, requirePublishedWorkWithParts } from '@/modules/works/service';

type StateRow = typeof readingStateTable.$inferSelect;
type PartRow = typeof readingPartTable.$inferSelect;

function toIso(value: Date): string {
  return value.toISOString();
}

function toState(row: StateRow) {
  return {
    status: row.status as ReaderSessionData['state']['status'],
    currentPartId: row.currentPartId,
    progressRatio: computeProgressRatio({
      status: row.status as ReaderSessionData['state']['status'],
      anchorKind: row.anchorKind,
      anchorValue: row.anchorValue,
    }),
    lastReadAt: toIso(row.lastReadAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
  };
}

function resolveCurrentPart(parts: PartRow[], state: StateRow | null): PartRow {
  if (state?.currentPartId) {
    const matched = parts.find((part) => part.id === state.currentPartId);
    if (matched) {
      return matched;
    }
  }
  return parts[0]!;
}

function buildSession(
  work: Awaited<ReturnType<typeof requirePublishedWorkWithParts>>['work'],
  tags: string[],
  parts: PartRow[],
  currentPart: PartRow,
  state: StateRow,
  audioAvailable: ReaderSessionData['audioAvailable'],
): ReaderSessionData {
  return {
    work: {
      id: work.id,
      title: work.title,
      description: work.description,
      tags,
      publishedAt: work.publishedAt ? toIso(work.publishedAt) : null,
    },
    parts: parts.map((part) => ({
      id: part.id,
      workId: part.workId,
      sortOrder: part.sortOrder,
      kind: part.kind as ReaderSessionData['parts'][number]['kind'],
      title: part.title,
      createdAt: toIso(part.createdAt),
      updatedAt: toIso(part.updatedAt),
    })),
    currentPart: {
      id: currentPart.id,
      workId: currentPart.workId,
      sortOrder: currentPart.sortOrder,
      kind: currentPart.kind as ReaderSessionData['currentPart']['kind'],
      title: currentPart.title,
      body: currentPart.body,
    },
    state: toState(state),
    audioAvailable,
  };
}

async function defaultAnonymousState(now: string): Promise<ReaderSessionData['state']> {
  return {
    status: 'in_progress',
    currentPartId: null,
    progressRatio: 0,
    lastReadAt: now,
    completedAt: null,
  };
}

/** Read-only reader payload for anonymous visitors; no user data is created. */
export async function getPublicReaderSession(workId: string): Promise<ReaderSessionData> {
  const { work, parts } = await requirePublishedWorkWithParts(workId);
  const tags = await loadTagsForWork(workId);
  const currentPart = parts[0]!;
  const now = new Date().toISOString();
  const audioAvailable = await getPartAudioAvailability(currentPart.id, currentPart.title, currentPart.body);

  return {
    work: {
      id: work.id,
      title: work.title,
      description: work.description,
      tags,
      publishedAt: work.publishedAt ? toIso(work.publishedAt) : null,
    },
    parts: parts.map((part) => ({
      id: part.id,
      workId: part.workId,
      sortOrder: part.sortOrder,
      kind: part.kind as ReaderSessionData['parts'][number]['kind'],
      title: part.title,
      createdAt: toIso(part.createdAt),
      updatedAt: toIso(part.updatedAt),
    })),
    currentPart: {
      id: currentPart.id,
      workId: currentPart.workId,
      sortOrder: currentPart.sortOrder,
      kind: currentPart.kind as ReaderSessionData['currentPart']['kind'],
      title: currentPart.title,
      body: currentPart.body,
    },
    state: await defaultAnonymousState(now),
    audioAvailable,
  };
}

/** Open reader content and track reading state (unless already completed). */
export async function getReaderSession(userId: string, workId: string): Promise<ReaderSessionData> {
  const { work, parts } = await requirePublishedWorkWithParts(workId);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(readingStateTable)
    .where(and(eq(readingStateTable.userId, userId), eq(readingStateTable.workId, workId)))
    .limit(1);

  let state: StateRow;
  if (!existing) {
    const firstPart = parts[0]!;
    const [created] = await db
      .insert(readingStateTable)
      .values({
        id: randomUUID(),
        userId,
        workId,
        currentPartId: firstPart.id,
        anchorKind: 'percent',
        anchorValue: '0',
        status: 'in_progress',
        addedAt: now,
        lastReadAt: now,
        completedAt: null,
      })
      .returning();
    if (!created) {
      throw new AppError(500, 'Failed to create reading state');
    }
    state = created;
  } else if (existing.status === 'completed') {
    const [updated] = await db
      .update(readingStateTable)
      .set({ lastReadAt: now })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    state = updated ?? existing;
  } else {
    const [updated] = await db
      .update(readingStateTable)
      .set({ lastReadAt: now })
      .where(eq(readingStateTable.id, existing.id))
      .returning();
    state = updated ?? existing;
  }

  const currentPart = resolveCurrentPart(parts, state);
  const audioAvailable = await getPartAudioAvailability(currentPart.id, currentPart.title, currentPart.body);
  await touchReadingDay(userId);

  const tags = await loadTagsForWork(workId);
  return buildSession(work, tags, parts, currentPart, state, audioAvailable);
}

export async function updateReadingState(
  userId: string,
  workId: string,
  input: UpdateReadingStateBody,
): Promise<ReaderSessionData['state']> {
  await requirePublishedWorkWithParts(workId);
  const now = new Date();

  const [existing] = await db
    .select()
    .from(readingStateTable)
    .where(and(eq(readingStateTable.userId, userId), eq(readingStateTable.workId, workId)))
    .limit(1);

  const currentRatio = existing
    ? computeProgressRatio({
        status: existing.status as ReaderSessionData['state']['status'],
        anchorKind: existing.anchorKind,
        anchorValue: existing.anchorValue,
      })
    : 0;

  const nextRatio = input.progressRatio !== undefined ? Math.max(currentRatio, input.progressRatio) : currentRatio;

  const nextStatus = input.status ?? existing?.status ?? 'in_progress';
  const completedAt =
    nextStatus === 'completed'
      ? (existing?.completedAt ?? now)
      : nextStatus === 'in_progress'
        ? null
        : existing?.completedAt;

  const patch = {
    status: nextStatus,
    anchorKind: 'percent' as const,
    anchorValue: String(nextRatio),
    lastReadAt: now,
    completedAt,
    ...(input.currentPartId !== undefined ? { currentPartId: input.currentPartId } : {}),
  };

  if (!existing) {
    const { parts } = await requirePublishedWorkWithParts(workId);
    const [created] = await db
      .insert(readingStateTable)
      .values({
        id: randomUUID(),
        userId,
        workId,
        currentPartId: input.currentPartId ?? parts[0]!.id,
        addedAt: now,
        ...patch,
      })
      .returning();
    if (!created) {
      throw new AppError(500, 'Failed to create reading state');
    }
    return toState(created);
  }

  const [updated] = await db
    .update(readingStateTable)
    .set(patch)
    .where(eq(readingStateTable.id, existing.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Reading state');
  }
  return toState(updated);
}

export { getPublishedPartAudioTrack };
