import { and, eq } from 'drizzle-orm';

import { article as articleTable, articleAudio as articleAudioTable } from '@elynd/db';
import {
  type ArticleAudioRole,
  type ArticleAudioTrack,
  type ArticleAudioView,
  buildArticleAudioText,
  type GenerateArticleAudioBody,
  type GenerateArticleAudioResult,
  type GenerateArticleAudioRoleResult,
} from '@elynd/shared/api/article-audio';
import { type TtsWordTiming } from '@elynd/shared/api/tts';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { hashArticleContent } from '@/modules/articles/content-hash';
import { deleteObject, getObject, objectExists, putObject } from '@/modules/oss';
import { recordTtsInvocation } from '@/modules/tts/log';
import { synthesizeTts } from '@/modules/tts/service';

const articleAudioLogger = rootLogger.child({ module: 'ArticleAudio' });

const ALL_ROLES: ArticleAudioRole[] = ['us', 'uk'];

type MetaRow = typeof articleAudioTable.$inferSelect;

export function articleAudioObjectKey(articleId: string, role: ArticleAudioRole, contentHash: string): string {
  return `article-audio/${articleId}/${role}/${contentHash}.mp3`;
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

async function readArticleAudioBytes(storageKey: string): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const object = await getObject(storageKey);
    if (!object) {
      return null;
    }
    return {
      audioBase64: object.body.toString('base64'),
      mimeType: object.contentType,
    };
  } catch (error) {
    articleAudioLogger.warn({ err: error, storageKey }, 'Object storage article audio read failed');
    return null;
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
  blob: { audioBase64: string; mimeType: string } | null;
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
    wordTimings: meta.wordTimings,
  };
}

export async function getArticleAudio(articleId: string): Promise<ArticleAudioView> {
  const article = await loadArticle(articleId);
  const currentContentHash = hashArticleContent(article.title, article.body);
  const metaRows = await db.select().from(articleAudioTable).where(eq(articleAudioTable.articleId, articleId));
  const metaByRole = new Map<string, MetaRow>();
  for (const row of metaRows) {
    if (row.role === 'us' || row.role === 'uk') {
      metaByRole.set(row.role, row);
    }
  }

  const usMeta = metaByRole.get('us') ?? null;
  const ukMeta = metaByRole.get('uk') ?? null;

  const tracks = {
    us: toTrack({
      role: 'us',
      currentContentHash,
      meta: usMeta,
      blob: usMeta ? await readArticleAudioBytes(usMeta.storageKey) : null,
    }),
    uk: toTrack({
      role: 'uk',
      currentContentHash,
      meta: ukMeta,
      blob: ukMeta ? await readArticleAudioBytes(ukMeta.storageKey) : null,
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
  const storageKey = articleAudioObjectKey(articleId, role, contentHash);
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

    await putObject({
      key: storageKey,
      body: result.audio,
      contentType: result.mimeType,
    });

    if (existing?.storageKey && existing.storageKey !== storageKey) {
      try {
        await deleteObject(existing.storageKey);
      } catch (error) {
        articleAudioLogger.warn(
          { err: error, articleId, role, key: existing.storageKey },
          'Failed to delete previous article audio object',
        );
      }
    }

    const generatedAt = new Date();
    await db
      .insert(articleAudioTable)
      .values({
        articleId,
        role,
        status: 'ready',
        voice: result.voice,
        contentHash,
        storageKey,
        mimeType: result.mimeType,
        durationMs: null,
        wordTimings: result.wordTimings,
        lastError: null,
        generatedAt,
      })
      .onConflictDoUpdate({
        target: [articleAudioTable.articleId, articleAudioTable.role],
        set: {
          status: 'ready',
          voice: result.voice,
          contentHash,
          storageKey,
          mimeType: result.mimeType,
          durationMs: null,
          wordTimings: result.wordTimings,
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
          storageKey: existing?.storageKey ?? storageKey,
          mimeType: existing?.mimeType ?? 'audio/mpeg',
          durationMs: existing?.durationMs ?? null,
          wordTimings: existing?.wordTimings ?? [],
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

  const contentHash = hashArticleContent(article.title, article.body);
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

async function isTrackPlayable(
  article: { title: string; body: string },
  articleId: string,
  role: ArticleAudioRole,
): Promise<boolean> {
  const sourceHash = hashArticleContent(article.title, article.body);
  const [meta] = await db
    .select()
    .from(articleAudioTable)
    .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)))
    .limit(1);
  if (!meta || meta.status !== 'ready' || meta.contentHash !== sourceHash) {
    return false;
  }
  try {
    return await objectExists(meta.storageKey);
  } catch (error) {
    articleAudioLogger.warn({ err: error, articleId, role }, 'Object storage exists check failed');
    return false;
  }
}

/** Learner: which accent tracks are ready, content-fresh, and present in object storage. */
export async function getArticleAudioAvailability(articleId: string): Promise<ArticleAudioAvailability> {
  const article = await loadArticle(articleId);
  const [us, uk] = await Promise.all([
    isTrackPlayable(article, articleId, 'us'),
    isTrackPlayable(article, articleId, 'uk'),
  ]);
  return { us, uk };
}

/** Learner: published article only; refuses stale or missing objects. */
export async function getPublishedArticleAudioTrack(
  articleId: string,
  role: ArticleAudioRole,
): Promise<{
  role: ArticleAudioRole;
  mimeType: string;
  voice: string;
  audioBase64: string;
  wordTimings: TtsWordTiming[];
}> {
  const [article] = await db
    .select({ id: articleTable.id, title: articleTable.title, body: articleTable.body })
    .from(articleTable)
    .where(and(eq(articleTable.id, articleId), eq(articleTable.status, 'published')))
    .limit(1);
  if (!article) {
    throw new NotFoundError('Article');
  }

  const sourceHash = hashArticleContent(article.title, article.body);
  const [meta] = await db
    .select()
    .from(articleAudioTable)
    .where(and(eq(articleAudioTable.articleId, articleId), eq(articleAudioTable.role, role)))
    .limit(1);
  if (!meta || meta.status !== 'ready' || meta.contentHash !== sourceHash) {
    throw new NotFoundError('Article audio');
  }

  const blob = await readArticleAudioBytes(meta.storageKey);
  if (!blob) {
    throw new NotFoundError('Article audio');
  }

  return {
    role,
    mimeType: blob.mimeType,
    voice: meta.voice,
    audioBase64: blob.audioBase64,
    wordTimings: meta.wordTimings,
  };
}
