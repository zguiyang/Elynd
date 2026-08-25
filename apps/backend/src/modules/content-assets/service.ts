import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
} from '@gloaming/db';
import {
  audioKindForRole,
  buildPartAudioText,
  type ContentAssetTrack,
  type GeneratePartAudioBody,
  type GeneratePartAudioResult,
  type GeneratePartAudioRoleResult,
  type PartAudioView,
  roleForAudioKind,
} from '@gloaming/shared/api/content-assets';
import { type ReaderAudioTrack } from '@gloaming/shared/api/reader';
import { type TtsVoiceRole } from '@gloaming/shared/api/tts';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { htmlToPlainText } from '@/lib/part-text';
import { deleteObject, getObject, objectExists, putObject } from '@/modules/oss';
import { recordTtsInvocation } from '@/modules/tts/log';
import { synthesizeTts } from '@/modules/tts/service';
import { hashPartContent } from '@/modules/works/content-hash';

const partAudioLogger = rootLogger.child({ module: 'ContentAssets' });

const ALL_ROLES: TtsVoiceRole[] = ['us', 'uk'];

type AssetRow = typeof contentAssetTable.$inferSelect;

export function partAudioObjectKey(partId: string, kind: string, contentHash: string): string {
  return `part-audio/${partId}/${kind}/${contentHash}.mp3`;
}

function resolveGenerateRoles(body: GeneratePartAudioBody): TtsVoiceRole[] {
  if (!body.roles?.length) {
    return [...ALL_ROLES];
  }
  return [...new Set(body.roles)];
}

async function loadPart(partId: string): Promise<{
  id: string;
  workId: string;
  title: string;
  body: string;
}> {
  const rows = await db
    .select({
      id: readingPartTable.id,
      workId: readingPartTable.workId,
      title: readingPartTable.title,
      body: readingPartTable.body,
    })
    .from(readingPartTable)
    .where(eq(readingPartTable.id, partId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Part');
  }
  return row;
}

async function readPartAudioBytes(storageKey: string): Promise<{ audioBase64: string; mimeType: string } | null> {
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
    partAudioLogger.warn({ err: error, storageKey }, 'Object storage part audio read failed');
    return null;
  }
}

function emptyTrack(role: TtsVoiceRole): ContentAssetTrack {
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
  role: TtsVoiceRole;
  currentContentHash: string;
  asset: AssetRow | null;
  blob: { audioBase64: string; mimeType: string } | null;
}): ContentAssetTrack {
  const { role, currentContentHash, asset, blob } = input;
  if (!asset) {
    return emptyTrack(role);
  }

  const status = asset.status === 'failed' ? 'failed' : 'ready';
  const audioAvailable = Boolean(blob);
  const expired = status === 'ready' && !audioAvailable;
  const meta = asset.meta ?? {};

  return {
    role,
    status,
    voice: meta.voice ?? null,
    contentHash: asset.contentHash,
    contentStale: asset.contentHash !== currentContentHash,
    mimeType: asset.mimeType,
    lastError: meta.lastError ?? null,
    generatedAt: meta.generatedAt ?? null,
    updatedAt: asset.updatedAt.toISOString(),
    audioAvailable,
    expired,
    audioBase64: blob?.audioBase64 ?? null,
    wordTimings: meta.wordTimings,
  };
}

export async function getPartAudio(partId: string): Promise<PartAudioView> {
  const part = await loadPart(partId);
  const currentContentHash = hashPartContent(part.title, part.body);
  const metaRows = await db.select().from(contentAssetTable).where(eq(contentAssetTable.partId, partId));
  const metaByKind = new Map<string, AssetRow>();
  for (const row of metaRows) {
    if (row.kind === 'audio_us' || row.kind === 'audio_uk') {
      metaByKind.set(row.kind, row);
    }
  }

  const usAsset = metaByKind.get('audio_us') ?? null;
  const ukAsset = metaByKind.get('audio_uk') ?? null;

  const tracks = {
    us: toTrack({
      role: 'us',
      currentContentHash,
      asset: usAsset,
      blob: usAsset ? await readPartAudioBytes(usAsset.storageKey) : null,
    }),
    uk: toTrack({
      role: 'uk',
      currentContentHash,
      asset: ukAsset,
      blob: ukAsset ? await readPartAudioBytes(ukAsset.storageKey) : null,
    }),
  };

  return {
    partId: part.id,
    workId: part.workId,
    title: part.title,
    currentContentHash,
    tracks,
  };
}

async function generateOneRole(input: {
  partId: string;
  workId: string;
  role: TtsVoiceRole;
  text: string;
  contentHash: string;
  userId?: string;
}): Promise<GeneratePartAudioRoleResult> {
  const { partId, workId, role, text, contentHash, userId } = input;
  const kind = audioKindForRole(role);
  const storageKey = partAudioObjectKey(partId, kind, contentHash);
  const existingRows = await db
    .select()
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.partId, partId), eq(contentAssetTable.kind, kind)))
    .limit(1);
  const existing = existingRows[0] ?? null;
  const started = Date.now();

  try {
    const result = await synthesizeTts({
      text,
      role,
      source: 'admin.part_audio',
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
        partAudioLogger.warn(
          { err: error, partId, role, key: existing.storageKey },
          'Failed to delete previous part audio object',
        );
      }
    }

    const generatedAt = new Date().toISOString();
    const values = {
      id: existing?.id ?? randomUUID(),
      workId,
      partId,
      kind,
      status: 'ready',
      storageKey,
      mimeType: result.mimeType,
      contentHash,
      meta: {
        voice: result.voice,
        wordTimings: result.wordTimings,
        lastError: undefined,
        generatedAt,
        durationMs: undefined,
      },
    };

    if (existing) {
      await db.update(contentAssetTable).set(values).where(eq(contentAssetTable.id, existing.id));
    } else {
      await db.insert(contentAssetTable).values(values);
    }

    await recordTtsInvocation({
      status: 'success',
      source: 'admin.part_audio',
      userId,
      workId,
      partId,
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
    const existingMeta = existing?.meta ?? {};

    const failedValues = {
      id: existing?.id ?? randomUUID(),
      workId,
      partId,
      kind,
      status: 'failed',
      storageKey: existing?.storageKey ?? storageKey,
      mimeType: existing?.mimeType ?? 'audio/mpeg',
      contentHash: existing?.contentHash ?? contentHash,
      meta: {
        ...existingMeta,
        lastError: message,
      },
    };

    if (existing) {
      await db.update(contentAssetTable).set(failedValues).where(eq(contentAssetTable.id, existing.id));
    } else {
      await db.insert(contentAssetTable).values(failedValues);
    }

    await recordTtsInvocation({
      status: 'failure',
      errorCode,
      errorMessage: message,
      source: 'admin.part_audio',
      userId,
      workId,
      partId,
      voice: existingMeta.voice ?? null,
      role,
      textPreview: text,
      textLength: text.length,
      latencyMs,
      cached: null,
    });

    return { role, ok: false, latencyMs, cached: null, error: message };
  }
}

export async function generatePartAudio(
  partId: string,
  body: GeneratePartAudioBody,
  options: { userId?: string },
): Promise<GeneratePartAudioResult> {
  const part = await loadPart(partId);
  const text = buildPartAudioText(part.title, htmlToPlainText(part.body));
  if (!text.trim()) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Part has no text to synthesize');
  }

  const contentHash = hashPartContent(part.title, part.body);
  const roles = resolveGenerateRoles(body);
  const results: GeneratePartAudioRoleResult[] = [];

  for (const role of roles) {
    results.push(
      await generateOneRole({
        partId,
        workId: part.workId,
        role,
        text,
        contentHash,
        userId: options.userId,
      }),
    );
  }

  const view = await getPartAudio(partId);
  return { ...view, results };
}

export type PartAudioAvailability = { us: boolean; uk: boolean };

async function isTrackPlayable(
  part: { title: string; body: string },
  partId: string,
  role: TtsVoiceRole,
): Promise<boolean> {
  const sourceHash = hashPartContent(part.title, part.body);
  const kind = audioKindForRole(role);
  const [asset] = await db
    .select()
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.partId, partId), eq(contentAssetTable.kind, kind)))
    .limit(1);
  if (!asset || asset.status !== 'ready' || asset.contentHash !== sourceHash) {
    return false;
  }
  try {
    return await objectExists(asset.storageKey);
  } catch (error) {
    partAudioLogger.warn({ err: error, partId, role }, 'Object storage exists check failed');
    return false;
  }
}

export async function getPartAudioAvailability(
  partId: string,
  title?: string,
  body?: string,
): Promise<PartAudioAvailability> {
  const part = title !== undefined && body !== undefined ? { title, body } : await loadPart(partId);
  const [us, uk] = await Promise.all([isTrackPlayable(part, partId, 'us'), isTrackPlayable(part, partId, 'uk')]);
  return { us, uk };
}

/** Learner image proxy: asset must belong to a published work (image/cover kinds). */
export async function getPublishedAsset(assetId: string): Promise<{ body: Buffer; mimeType: string } | null> {
  const [asset] = await db
    .select({
      storageKey: contentAssetTable.storageKey,
      mimeType: contentAssetTable.mimeType,
      kind: contentAssetTable.kind,
      workId: contentAssetTable.workId,
    })
    .from(contentAssetTable)
    .innerJoin(readingWorkTable, eq(contentAssetTable.workId, readingWorkTable.id))
    .where(and(eq(contentAssetTable.id, assetId), eq(readingWorkTable.status, 'published')))
    .limit(1);
  if (!asset || !(asset.kind === 'image' || asset.kind === 'cover')) {
    return null;
  }
  try {
    const object = await getObject(asset.storageKey);
    if (!object) return null;
    return { body: object.body, mimeType: object.contentType || asset.mimeType };
  } catch (error) {
    partAudioLogger.warn({ err: error, assetId, storageKey: asset.storageKey }, 'Asset object read failed');
    return null;
  }
}

/** Learner: published work only; refuses stale or missing objects. */
export async function getPublishedPartAudioTrack(partId: string, role: TtsVoiceRole): Promise<ReaderAudioTrack> {
  const [part] = await db
    .select({
      id: readingPartTable.id,
      title: readingPartTable.title,
      body: readingPartTable.body,
      workId: readingPartTable.workId,
    })
    .from(readingPartTable)
    .innerJoin(readingWorkTable, eq(readingPartTable.workId, readingWorkTable.id))
    .where(and(eq(readingPartTable.id, partId), eq(readingWorkTable.status, 'published')))
    .limit(1);

  if (!part) {
    throw new NotFoundError('Part');
  }

  const sourceHash = hashPartContent(part.title, part.body);
  const kind = audioKindForRole(role);
  const [asset] = await db
    .select()
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.partId, partId), eq(contentAssetTable.kind, kind)))
    .limit(1);
  if (!asset || asset.status !== 'ready' || asset.contentHash !== sourceHash) {
    throw new NotFoundError('Part audio');
  }

  const blob = await readPartAudioBytes(asset.storageKey);
  if (!blob) {
    throw new NotFoundError('Part audio');
  }

  const meta = asset.meta ?? {};

  return {
    role,
    mimeType: blob.mimeType,
    voice: meta.voice ?? roleForAudioKind(kind),
    audioBase64: blob.audioBase64,
    wordTimings: meta.wordTimings ?? [],
  };
}
