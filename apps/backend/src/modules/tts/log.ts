import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm';

import { article as articleTable, ttsInvocationLog as ttsInvocationLogTable } from '@elynd/db';
import { buildPaginationMeta } from '@elynd/shared/api/pagination';
import { type TtsVoiceRole } from '@elynd/shared/api/tts';
import {
  resolveTtsInvocationWindow,
  type TtsInvocationListData,
  type TtsInvocationListQuery,
  type TtsInvocationLog,
  type TtsInvocationStats,
  type TtsInvocationStatsQuery,
  type TtsInvocationStatus,
} from '@elynd/shared/api/tts-invocations';

import { db } from '@/db';

const PREVIEW_MAX = 200;
const ERROR_MESSAGE_MAX = 500;

export type TtsInvocationLogInput = {
  status: 'success' | 'failure';
  errorCode?: string | null;
  errorMessage?: string | null;
  source: string;
  userId?: string | null;
  articleId?: string | null;
  voice?: string | null;
  role?: TtsVoiceRole | null;
  textPreview?: string | null;
  textLength?: number | null;
  latencyMs?: number | null;
  cached?: boolean | null;
};

function truncatePreview(text: string, max = PREVIEW_MAX): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function truncateErrorMessage(message: string): string {
  return truncatePreview(message, ERROR_MESSAGE_MAX);
}

/** Persist one business-level TTS invocation (truncated preview — no full text). */
export async function recordTtsInvocation(input: TtsInvocationLogInput): Promise<void> {
  await db.insert(ttsInvocationLogTable).values({
    id: randomUUID(),
    status: input.status,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ? truncateErrorMessage(input.errorMessage) : null,
    source: input.source,
    userId: input.userId ?? null,
    articleId: input.articleId ?? null,
    voice: input.voice ?? null,
    role: input.role ?? null,
    textPreview: input.textPreview ? truncatePreview(input.textPreview) : null,
    textLength: input.textLength ?? null,
    latencyMs: input.latencyMs ?? null,
    cached: input.cached ?? null,
  });
}

type InvocationLogRow = typeof ttsInvocationLogTable.$inferSelect;

function toStatus(value: string): TtsInvocationStatus {
  return value === 'failure' ? 'failure' : 'success';
}

function toRole(value: string | null): TtsVoiceRole | null {
  return value === 'us' || value === 'uk' ? value : null;
}

function toLog(row: InvocationLogRow, articleTitle: string | null): TtsInvocationLog {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    status: toStatus(row.status),
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    source: row.source,
    userId: row.userId,
    articleId: row.articleId,
    articleTitle,
    voice: row.voice,
    role: toRole(row.role),
    textPreview: row.textPreview,
    textLength: row.textLength,
    latencyMs: row.latencyMs,
    cached: row.cached,
  };
}

function invocationWhere(filter: { from: Date; to: Date; status?: TtsInvocationStatus; articleId?: string }): SQL {
  const parts: SQL[] = [
    gte(ttsInvocationLogTable.createdAt, filter.from),
    lte(ttsInvocationLogTable.createdAt, filter.to),
  ];
  if (filter.status) {
    parts.push(eq(ttsInvocationLogTable.status, filter.status));
  }
  if (filter.articleId) {
    parts.push(eq(ttsInvocationLogTable.articleId, filter.articleId));
  }
  return and(...parts)!;
}

export async function listTtsInvocations(query: TtsInvocationListQuery): Promise<TtsInvocationListData> {
  const window = resolveTtsInvocationWindow(query);
  const where = invocationWhere({
    ...window,
    status: query.status,
    articleId: query.articleId,
  });
  const offset = (query.page - 1) * query.pageSize;
  const createdAtOrder =
    query.sortOrder === 'asc' ? asc(ttsInvocationLogTable.createdAt) : desc(ttsInvocationLogTable.createdAt);
  const idOrder = query.sortOrder === 'asc' ? asc(ttsInvocationLogTable.id) : desc(ttsInvocationLogTable.id);

  const [countRow] = await db.select({ value: count() }).from(ttsInvocationLogTable).where(where);
  const total = Number(countRow?.value ?? 0);
  const rows = await db
    .select({
      log: ttsInvocationLogTable,
      articleTitle: articleTable.title,
    })
    .from(ttsInvocationLogTable)
    .leftJoin(articleTable, eq(ttsInvocationLogTable.articleId, articleTable.id))
    .where(where)
    .orderBy(createdAtOrder, idOrder)
    .limit(query.pageSize)
    .offset(offset);

  return {
    items: rows.map((row) => toLog(row.log, row.articleTitle ?? null)),
    pagination: buildPaginationMeta({
      page: query.page,
      pageSize: query.pageSize,
      total,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }),
  };
}

export async function getTtsInvocationStats(query: TtsInvocationStatsQuery): Promise<TtsInvocationStats> {
  const window = resolveTtsInvocationWindow(query);
  const where = invocationWhere({ ...window, status: query.status });

  const [row] = await db
    .select({
      successCount: sql<string>`coalesce(sum(case when ${ttsInvocationLogTable.status} = 'success' then 1 else 0 end), 0)`,
      failureCount: sql<string>`coalesce(sum(case when ${ttsInvocationLogTable.status} = 'failure' then 1 else 0 end), 0)`,
      totalCount: count(),
    })
    .from(ttsInvocationLogTable)
    .where(where);

  const successCount = Number(row?.successCount ?? 0);
  const failureCount = Number(row?.failureCount ?? 0);
  const totalCount = Number(row?.totalCount ?? 0);

  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    successCount,
    failureCount,
    totalCount,
  };
}
