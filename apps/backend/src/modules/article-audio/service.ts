import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { article as articleTable, articleAudio as articleAudioTable } from '@elynd/db';
import {
  type ArticleAudioView,
  type GenerateArticleAudioBody,
  type GenerateArticleAudioResult,
} from '@elynd/shared/api/article-audio';
import { type TtsVoiceRole, ttsWordTimingSchema } from '@elynd/shared/api/tts';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { recordTtsInvocation } from '@/modules/tts/log';
import { synthesizeTts } from '@/modules/tts/service';

const articleAudioLogger = rootLogger.child({ module: 'ArticleAudio' });

const ARTICLE_AUDIO_TTL_SECONDS = 30 * 24 * 60 * 60;

const articleAudioRedisPayloadSchema = z.object({
  mimeType: z.string().min(1),
  voice: z.string().min(1),
  audioBase64: z.string().min(1),
  wordTimings: z.array(ttsWordTimingSchema),
  contentHash: z.string().min(1),
});

type ArticleAudioRedisPayload = z.infer<typeof articleAudioRedisPayloadSchema>;

function articleAudioRedisKey(articleId: string): string {
  return `elynd:article-audio:v1:${articleId}`;
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

async function readArticleAudioBlob(articleId: string): Promise<ArticleAudioRedisPayload | null> {
  const key = articleAudioRedisKey(articleId);
  try {
    const raw = await getRedis().get(key);
    if (!raw) {
      return null;
    }
    const parsed = articleAudioRedisPayloadSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      articleAudioLogger.warn({ articleId, key }, 'Invalid article audio Redis payload; ignoring');
      return null;
    }
    return parsed.data;
  } catch (error) {
    articleAudioLogger.warn({ err: error, articleId }, 'Redis article audio read failed');
    return null;
  }
}

async function writeArticleAudioBlob(articleId: string, payload: ArticleAudioRedisPayload): Promise<void> {
  const key = articleAudioRedisKey(articleId);
  try {
    await getRedis().set(key, JSON.stringify(payload), 'EX', ARTICLE_AUDIO_TTL_SECONDS);
  } catch (error) {
    articleAudioLogger.warn({ err: error, articleId }, 'Redis article audio write failed');
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Failed to store article audio');
  }
}

type MetaRow = typeof articleAudioTable.$inferSelect;

function toView(input: {
  article: { id: string; title: string };
  currentContentHash: string;
  meta: MetaRow | null;
  blob: ArticleAudioRedisPayload | null;
}): ArticleAudioView {
  const { article, currentContentHash, meta, blob } = input;
  if (!meta) {
    return {
      articleId: article.id,
      title: article.title,
      status: 'none',
      voice: null,
      role: null,
      contentHash: null,
      currentContentHash,
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

  const status = meta.status === 'failed' ? 'failed' : 'ready';
  const audioAvailable = Boolean(blob);
  const expired = status === 'ready' && !audioAvailable;
  const contentStale = meta.contentHash !== currentContentHash;

  return {
    articleId: article.id,
    title: article.title,
    status,
    voice: meta.voice,
    role: meta.role === 'us' || meta.role === 'uk' ? meta.role : null,
    contentHash: meta.contentHash,
    currentContentHash,
    contentStale,
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
  const metaRows = await db.select().from(articleAudioTable).where(eq(articleAudioTable.articleId, articleId)).limit(1);
  const meta = metaRows[0] ?? null;
  const blob = meta ? await readArticleAudioBlob(articleId) : null;
  return toView({ article, currentContentHash, meta, blob });
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
  const role: TtsVoiceRole | undefined = body.role;
  const redisKey = articleAudioRedisKey(articleId);
  const existingRows = await db
    .select()
    .from(articleAudioTable)
    .where(eq(articleAudioTable.articleId, articleId))
    .limit(1);
  const existing = existingRows[0] ?? null;

  const started = Date.now();
  try {
    const result = await synthesizeTts({
      text,
      role,
      source: 'admin.article_audio',
      userId: options.userId,
    });
    const latencyMs = Date.now() - started;

    await writeArticleAudioBlob(articleId, {
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
        status: 'ready',
        voice: result.voice,
        role: role ?? null,
        contentHash,
        redisKey,
        mimeType: result.mimeType,
        durationMs: null,
        lastError: null,
        generatedAt,
      })
      .onConflictDoUpdate({
        target: articleAudioTable.articleId,
        set: {
          status: 'ready',
          voice: result.voice,
          role: role ?? null,
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
      userId: options.userId,
      articleId,
      voice: result.voice,
      role: role ?? null,
      textPreview: text,
      textLength: text.length,
      latencyMs,
      cached: result.cached,
    });

    const view = await getArticleAudio(articleId);
    return { ...view, latencyMs, cached: result.cached };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof AppError ? String(error.statusCode) : '500';

    if (existing?.status === 'ready') {
      await db.update(articleAudioTable).set({ lastError: message }).where(eq(articleAudioTable.articleId, articleId));
    } else {
      await db
        .insert(articleAudioTable)
        .values({
          articleId,
          status: 'failed',
          voice: existing?.voice ?? 'unknown',
          role: role ?? existing?.role ?? null,
          contentHash: existing?.contentHash ?? contentHash,
          redisKey: existing?.redisKey ?? redisKey,
          mimeType: existing?.mimeType ?? 'audio/mpeg',
          durationMs: existing?.durationMs ?? null,
          lastError: message,
          generatedAt: existing?.generatedAt ?? null,
        })
        .onConflictDoUpdate({
          target: articleAudioTable.articleId,
          set: {
            status: 'failed',
            lastError: message,
            role: role ?? existing?.role ?? null,
          },
        });
    }

    await recordTtsInvocation({
      status: 'failure',
      errorCode,
      errorMessage: message,
      source: 'admin.article_audio',
      userId: options.userId,
      articleId,
      voice: existing?.voice ?? null,
      role: role ?? null,
      textPreview: text,
      textLength: text.length,
      latencyMs,
      cached: null,
    });

    throw error instanceof AppError ? error : new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, message);
  }
}
