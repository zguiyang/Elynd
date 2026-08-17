import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { article as articleTable, articleAudio as articleAudioTable } from '@elynd/db';
import {
  type ArticleAudioRole,
  type ArticleAudioTrack,
  type ArticleAudioView,
  type GenerateArticleAudioBody,
  type GenerateArticleAudioResult,
  type GenerateArticleAudioRoleResult,
} from '@elynd/shared/api/article-audio';
import { ttsWordTimingSchema } from '@elynd/shared/api/tts';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { recordTtsInvocation } from '@/modules/tts/log';
import { synthesizeTts } from '@/modules/tts/service';

const articleAudioLogger = rootLogger.child({ module: 'ArticleAudio' });

const ARTICLE_AUDIO_TTL_SECONDS = 30 * 24 * 60 * 60;
const ALL_ROLES: ArticleAudioRole[] = ['us', 'uk'];

const articleAudioRedisPayloadSchema = z.object({
  mimeType: z.string().min(1),
  voice: z.string().min(1),
  audioBase64: z.string().min(1),
  wordTimings: z.array(ttsWordTimingSchema),
  contentHash: z.string().min(1),
});

type ArticleAudioRedisPayload = z.infer<typeof articleAudioRedisPayloadSchema>;
type MetaRow = typeof articleAudioTable.$inferSelect;

function articleAudioRedisKey(articleId: string, role: ArticleAudioRole): string {
  return `elynd:article-audio:v1:${articleId}:${role}`;
}

export function buildArticleAudioText(title: string, body: string): string {
  const normalizedTitle = title.trim().replace(/\s+/g, ' ');
  const normalizedBody = body.trim().replace(/\s+/g, ' ');
  if (!normalizedTitle) {
    return normalizedBody;
  }
  if (!normalizedBody) {
    return normalizedTitle;
  }
  return `${normalizedTitle}\n\n${normalizedBody}`;
}

export function hashArticleAudioContent(title: string, body: string): string {
  return createHash('sha256').update(buildArticleAudioText(title, body), 'utf8').digest('hex');
}

function resolveGenerateRoles(body: GenerateArticleAudioBody): ArticleAudioRole[] {
  if (!body.roles?.length) {
    return [...ALL_ROLES];
  }
  return [...new Set(body.roles)];
}

async function loadArticle(articleId: string): Promise<{ id: string; title: string; body: string }> {
  const rows = await db
    .select({ id: articleTable.id, title: articleTable.title, body: articleTable.body })
    .from(articleTable)
    .where(eq(articleTable.id, articleId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Article');
  }
  return row;
}

async function readArticleAudioBlob(
  articleId: string,
  role: ArticleAudioRole,
): Promise<ArticleAudioRedisPayload | null> {
  const key = articleAudioRedisKey(articleId, role);
  try {
    const raw = await getRedis().get(key);
    if (!raw) {
      return null;
    }
    const parsed = articleAudioRedisPayloadSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      articleAudioLogger.warn({ articleId, role, key }, 'Invalid article audio Redis payload; ignoring');
      return null;
    }
    return parsed.data;
  } catch (error) {
    articleAudioLogger.warn({ err: error, articleId, role }, 'Redis article audio read failed');
    return null;
  }
}

async function writeArticleAudioBlob(
  articleId: string,
  role: ArticleAudioRole,
  payload: ArticleAudioRedisPayload,
): Promise<void> {
  const key = articleAudioRedisKey(articleId, role);
  try {
    await getRedis().set(key, JSON.stringify(payload), 'EX', ARTICLE_AUDIO_TTL_SECONDS);
  } catch (error) {
    articleAudioLogger.warn({ err: error, articleId, role }, 'Redis article audio write failed');
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to store article audio');
  }
}

function emptyTrack(role: ArticleAudioRole): ArticleAudioTrack {
  return {
    role,
    status: 'none',
    voice: null,
    contentHash: null,
    contentStale: false,
    mimeType: null,
    lastError: null,
    generatedAt: null,
    updatedAt: null,
    audioAvailable: false,
    expired: false,
    audioBase64: null,
    wordTimings: undefined,
  };
}

function toTrack(input: {
  role: ArticleAudioRole;
  currentContentHash: string;
  meta: MetaRow | null;
  blob: ArticleAudioRedisPayload | null;
}): ArticleAudioTrack {
  const { role, currentContentHash, meta, blob } = input;
  if (!meta) {
    return emptyTrack(role);
  }

  const status = meta.status === 'failed' ? 'failed' : 'ready';
  const audioAvailable = Boolean(blob);
  const expired = status === 'ready' && !audioAvailable;

  return {
    role,
    status,
    voice: meta.voice,
    contentHash: meta.contentHash,
    contentStale: meta.contentHash !== currentContentHash,
    mimeType: meta.mimeType,
    lastError: meta.lastError,
    generatedAt: meta.generatedAt?.toISOString() ?? null,
    updatedAt: meta.updatedAt.toISOString(),
    audioAvailable,
    expired,
    audioBase64: blob?.audioBase64 ?? null,
    wordTimings: blob?.wordTimings,
  };
}

export async function getArticleAudio(articleId: string): Promise<ArticleAudioView> {
  const article = await loadArticle(articleId);
  const currentContentHash = hashArticleAudioContent(article.title, article.body);
  const metaRows = await db.select().from(articleAudioTable).where(eq(articleAudioTable.articleId, articleId));
  const metaByRole = new Map<string, MetaRow>();
  for (const row of metaRows) {
    if (row.role === 'us' || row.role === 'uk') {
      metaByRole.set(row.role, row);
    }
  }

  const tracks = {
    us: toTrack({
      role: 'us',
      currentContentHash,
      meta: metaByRole.get('us') ?? null,
      blob: metaByRole.has('us') ? await readArticleAudioBlob(articleId, 'us') : null,
    }),
    uk: toTrack({
      role: 'uk',
      currentContentHash,
      meta: metaByRole.get('uk') ?? null,
      blob: metaByRole.has('uk') ? await readArticleAudioBlob(articleId, 'uk') : null,
    }),
  };

  return {
    articleId: article.id,
    title: article.title,
    currentContentHash,
    tracks,
  };
}

async function generateOneRole(input: {
  articleId: string;
  role: ArticleAudioRole;
  text: string;
  contentHash: string;
  userId?: string;
}): Promise<GenerateArticleAudioRoleResult> {
  const { articleId, role, text, contentHash, userId } = input;
  const redisKey = articleAudioRedisKey(articleId, role);
  const existingRows = await db
    .select()
    .from(articleAudioTable)
    .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)))
    .limit(1);
  const existing = existingRows[0] ?? null;
  const started = Date.now();

  try {
    const result = await synthesizeTts({
      text,
      role,
      source: 'admin.article_audio',
      userId,
    });
    const latencyMs = Date.now() - started;

    await writeArticleAudioBlob(articleId, role, {
      mimeType: result.mimeType,
      voice: result.voice,
      audioBase64: result.audio.toString('base64'),
      wordTimings: result.wordTimings,
      contentHash,
    });

    const generatedAt = new Date();
    await db
      .insert(articleAudioTable)
      .values({
        articleId,
        role,
        status: 'ready',
        voice: result.voice,
        contentHash,
        redisKey,
        mimeType: result.mimeType,
        durationMs: null,
        lastError: null,
        generatedAt,
      })
      .onConflictDoUpdate({
        target: [articleAudioTable.articleId, articleAudioTable.role],
        set: {
          status: 'ready',
          voice: result.voice,
          contentHash,
          redisKey,
          mimeType: result.mimeType,
          durationMs: null,
          lastError: null,
          generatedAt,
        },
      });

    await recordTtsInvocation({
      status: 'success',
      source: 'admin.article_audio',
      userId,
      articleId,
      voice: result.voice,
      role,
      textPreview: text,
      textLength: text.length,
      latencyMs,
      cached: result.cached,
    });

    return { role, ok: true, latencyMs, cached: result.cached, error: null };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof AppError ? String(error.statusCode) : '500';

    if (existing?.status === 'ready') {
      await db
        .update(articleAudioTable)
        .set({ lastError: message })
        .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)));
    } else {
      await db
        .insert(articleAudioTable)
        .values({
          articleId,
          role,
          status: 'failed',
          voice: existing?.voice ?? 'unknown',
          contentHash: existing?.contentHash ?? contentHash,
          redisKey: existing?.redisKey ?? redisKey,
          mimeType: existing?.mimeType ?? 'audio/mpeg',
          durationMs: existing?.durationMs ?? null,
          lastError: message,
          generatedAt: existing?.generatedAt ?? null,
        })
        .onConflictDoUpdate({
          target: [articleAudioTable.articleId, articleAudioTable.role],
          set: {
            status: 'failed',
            lastError: message,
          },
        });
    }

    await recordTtsInvocation({
      status: 'failure',
      errorCode,
      errorMessage: message,
      source: 'admin.article_audio',
      userId,
      articleId,
      voice: existing?.voice ?? null,
      role,
      textPreview: text,
      textLength: text.length,
      latencyMs,
      cached: null,
    });

    return { role, ok: false, latencyMs, cached: null, error: message };
  }
}

export async function generateArticleAudio(
  articleId: string,
  body: GenerateArticleAudioBody,
  options: { userId?: string },
): Promise<GenerateArticleAudioResult> {
  const article = await loadArticle(articleId);
  const text = buildArticleAudioText(article.title, article.body);
  if (!text.trim()) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Article has no text to synthesize');
  }

  const contentHash = hashArticleAudioContent(article.title, article.body);
  const roles = resolveGenerateRoles(body);
  const results: GenerateArticleAudioRoleResult[] = [];

  for (const role of roles) {
    results.push(
      await generateOneRole({
        articleId,
        role,
        text,
        contentHash,
        userId: options.userId,
      }),
    );
  }

  const view = await getArticleAudio(articleId);
  return { ...view, results };
}

export type ArticleAudioAvailability = { us: boolean; uk: boolean };

async function isTrackPlayable(articleId: string, role: ArticleAudioRole): Promise<boolean> {
  const [meta] = await db
    .select()
    .from(articleAudioTable)
    .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)))
    .limit(1);
  if (!meta || meta.status !== 'ready') {
    return false;
  }
  const blob = await readArticleAudioBlob(articleId, role);
  return Boolean(blob);
}

/** Learner: which accent tracks are ready with Redis bytes present. */
export async function getArticleAudioAvailability(articleId: string): Promise<ArticleAudioAvailability> {
  const [us, uk] = await Promise.all([isTrackPlayable(articleId, 'us'), isTrackPlayable(articleId, 'uk')]);
  return { us, uk };
}

/** Learner: published article only; returns one track blob or NotFound. */
export async function getPublishedArticleAudioTrack(
  articleId: string,
  role: ArticleAudioRole,
): Promise<{ role: ArticleAudioRole; mimeType: string; voice: string; audioBase64: string }> {
  const [article] = await db
    .select({ id: articleTable.id })
    .from(articleTable)
    .where(and(eq(articleTable.id, articleId), eq(articleTable.status, 'published')))
    .limit(1);
  if (!article) {
    throw new NotFoundError('Article');
  }

  const [meta] = await db
    .select()
    .from(articleAudioTable)
    .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)))
    .limit(1);
  if (!meta || meta.status !== 'ready') {
    throw new NotFoundError('Article audio');
  }

  const blob = await readArticleAudioBlob(articleId, role);
  if (!blob) {
    throw new NotFoundError('Article audio');
  }

  return {
    role,
    mimeType: blob.mimeType,
    voice: blob.voice,
    audioBase64: blob.audioBase64,
  };
}
