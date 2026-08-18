import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  article as articleTable,
  articleAudio as articleAudioTable,
  ttsConfig as ttsConfigTable,
  ttsInvocationLog as ttsInvocationLogTable,
  user as userTable,
} from '@elynd/db';
import type { ArticleAudioView, GenerateArticleAudioResult } from '@elynd/shared/api/article-audio';
import type { AdminArticle } from '@elynd/shared/api/articles';
import type { TtsInvocationListData, TtsInvocationStats } from '@elynd/shared/api/tts-invocations';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import { encryptApiKey } from '@/lib/llm';
import * as redisLib from '@/lib/redis';
import * as azureTts from '@/lib/tts/azure';
import { articleAudioObjectKey } from '@/modules/article-audio/service';
import { hashArticleContent } from '@/modules/articles/content-hash';
import { resetObjectStoreCache, setObjectStoreForTests } from '@/modules/oss';
import { TTS_CONFIG_ID } from '@/modules/tts/service';

import { createMemoryObjectStore } from '../helpers/memory-oss';

const password = 'password123';

type TtsConfigRow = typeof ttsConfigTable.$inferSelect;

let priorConfig: TtsConfigRow | null | undefined;

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function cookieHeader(response: Response): string {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (getSetCookie?.length) {
    return getSetCookie.map((entry) => entry.split(';')[0]).join('; ');
  }
  const single = response.headers.get('set-cookie');
  return single ? single.split(';')[0]! : '';
}

async function signUp(input: { email: string; username: string; name: string }) {
  return app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: input.email,
      password,
      name: input.name,
      username: input.username,
    }),
  });
}

async function markEmailVerified(email: string) {
  await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));
}

async function setUserRole(email: string, role: string) {
  await db.update(userTable).set({ role }).where(eq(userTable.email, email));
}

async function signInEmail(email: string) {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email, password }),
  });
}

async function createSession(role: 'user' | 'admin' = 'user') {
  const email = uniqueEmail(role);
  const username = `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  expect((await signUp({ email, username, name: role })).status).toBe(200);
  await markEmailVerified(email);
  if (role === 'admin') {
    await setUserRole(email, AUTH_ADMIN_ROLE);
  }
  const login = await signInEmail(email);
  expect(login.status).toBe(200);
  return { email, cookie: cookieHeader(login) };
}

function createMemoryRedis() {
  const store = new Map<string, string>();
  return {
    store,
    client: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    },
  };
}

async function restorePriorConfig(): Promise<void> {
  if (priorConfig === undefined) {
    return;
  }
  await db.delete(ttsConfigTable).where(eq(ttsConfigTable.id, TTS_CONFIG_ID));
  if (priorConfig) {
    await db.insert(ttsConfigTable).values(priorConfig);
  }
}

async function ensureTtsConfig(): Promise<void> {
  await db
    .insert(ttsConfigTable)
    .values({
      id: TTS_CONFIG_ID,
      provider: 'azure',
      region: 'eastasia',
      apiKeyCiphertext: encryptApiKey('article-audio-test-key'),
      isEnabled: true,
      defaultVoice: 'en-US-JennyNeural',
      usVoice: 'en-US-GuyNeural',
      ukVoice: 'en-GB-SoniaNeural',
    })
    .onConflictDoUpdate({
      target: ttsConfigTable.id,
      set: {
        region: 'eastasia',
        apiKeyCiphertext: encryptApiKey('article-audio-test-key'),
        isEnabled: true,
        defaultVoice: 'en-US-JennyNeural',
        usVoice: 'en-US-GuyNeural',
        ukVoice: 'en-GB-SoniaNeural',
      },
    });
}

beforeAll(async () => {
  const rows = await db.select().from(ttsConfigTable).where(eq(ttsConfigTable.id, TTS_CONFIG_ID)).limit(1);
  priorConfig = rows[0] ?? null;
});

afterAll(async () => {
  await restorePriorConfig();
  resetObjectStoreCache();
});

describe('admin article audio', () => {
  it('generates both roles, supports single regenerate, expired, and logs', async () => {
    const admin = await createSession('admin');
    await ensureTtsConfig();

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Audio Title',
        body: 'Hello audio body.',
        level: 'easy',
        themes: ['daily'],
      }),
    });
    expect(create.status).toBe(201);
    const article = (await create.json()) as AdminArticle;
    expect(article.derivedFreshness.audio).toBe('missing');

    const memoryRedis = createMemoryRedis();
    const objectStore = createMemoryObjectStore();
    setObjectStoreForTests(objectStore);
    const redisSpy = vi.spyOn(redisLib, 'getRedis').mockReturnValue(memoryRedis.client as never);
    const synthesizeSpy = vi.spyOn(azureTts, 'synthesizeAzureTts').mockImplementation(async (input) => ({
      audio: Buffer.from(`mp3-${input.voice}`),
      mimeType: 'audio/mpeg',
      wordTimings: [{ text: 'Hello', audioOffsetMs: 0, durationMs: 100, textOffset: 0 }],
    }));

    const empty = await app.request(`/api/admin/articles/${article.id}/audio`, {
      headers: { Cookie: admin.cookie },
    });
    expect(empty.status).toBe(200);
    const emptyBody = (await empty.json()) as ArticleAudioView;
    expect(emptyBody.tracks.us.status).toBe('none');
    expect(emptyBody.tracks.uk.status).toBe('none');

    const generated = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(generated.status).toBe(200);
    const generatedBody = (await generated.json()) as GenerateArticleAudioResult;
    expect(generatedBody.results).toHaveLength(2);
    expect(generatedBody.results.every((item) => item.ok)).toBe(true);
    expect(generatedBody.tracks.us.status).toBe('ready');
    expect(generatedBody.tracks.uk.status).toBe('ready');
    expect(generatedBody.tracks.us.voice).toBe('en-US-GuyNeural');
    expect(generatedBody.tracks.uk.voice).toBe('en-GB-SoniaNeural');
    expect(synthesizeSpy).toHaveBeenCalledTimes(2);

    const contentHash = hashArticleContent('Audio Title', 'Hello audio body.');
    expect(objectStore.store.has(articleAudioObjectKey(article.id, 'us', contentHash))).toBe(true);
    expect(objectStore.store.has(articleAudioObjectKey(article.id, 'uk', contentHash))).toBe(true);

    const metaRows = await db.select().from(articleAudioTable).where(eq(articleAudioTable.articleId, article.id));
    expect(metaRows).toHaveLength(2);
    expect(metaRows[0]?.wordTimings.length).toBeGreaterThan(0);

    const detail = await app.request(`/api/admin/articles/${article.id}`, {
      headers: { Cookie: admin.cookie },
    });
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as AdminArticle).derivedFreshness.audio).toBe('fresh');

    const logs = await app.request(
      `/api/admin/tts/invocations?pageSize=20&status=success&articleId=${encodeURIComponent(article.id)}`,
      { headers: { Cookie: admin.cookie } },
    );
    expect(logs.status).toBe(200);
    const logsBody = (await logs.json()) as TtsInvocationListData;
    expect(logsBody.items.filter((item) => item.source === 'admin.article_audio')).toHaveLength(2);

    const stats = await app.request('/api/admin/tts/invocations/stats', {
      headers: { Cookie: admin.cookie },
    });
    expect(stats.status).toBe(200);
    const statsBody = (await stats.json()) as TtsInvocationStats;
    expect(statsBody.successCount).toBeGreaterThanOrEqual(2);

    synthesizeSpy.mockClear();
    const usOnly = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: ['us'] }),
    });
    expect(usOnly.status).toBe(200);
    const usOnlyBody = (await usOnly.json()) as GenerateArticleAudioResult;
    expect(usOnlyBody.results).toHaveLength(1);
    expect(usOnlyBody.results[0]?.role).toBe('us');
    expect(usOnlyBody.results[0]?.ok).toBe(true);
    expect(usOnlyBody.results[0]?.cached).toBe(true);
    expect(synthesizeSpy).not.toHaveBeenCalled();

    objectStore.store.delete(articleAudioObjectKey(article.id, 'uk', contentHash));
    for (const key of [...memoryRedis.store.keys()]) {
      if (key.startsWith('elynd:tts:v1:')) {
        memoryRedis.store.delete(key);
      }
    }
    const expired = await app.request(`/api/admin/articles/${article.id}/audio`, {
      headers: { Cookie: admin.cookie },
    });
    expect(expired.status).toBe(200);
    const expiredBody = (await expired.json()) as ArticleAudioView;
    expect(expiredBody.tracks.uk.expired).toBe(true);
    expect(expiredBody.tracks.us.audioAvailable).toBe(true);

    synthesizeSpy.mockRejectedValueOnce(new Error('azure down'));
    const failed = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: ['uk'] }),
    });
    expect(failed.status).toBe(200);
    const failedBody = (await failed.json()) as GenerateArticleAudioResult;
    expect(failedBody.results[0]?.ok).toBe(false);
    expect(failedBody.tracks.uk.status).toBe('ready');
    expect(failedBody.tracks.uk.lastError).toContain('azure down');
    expect(failedBody.tracks.us.status).toBe('ready');

    const failLogs = await app.request(
      `/api/admin/tts/invocations?status=failure&articleId=${encodeURIComponent(article.id)}`,
      { headers: { Cookie: admin.cookie } },
    );
    expect(failLogs.status).toBe(200);
    const failLogsBody = (await failLogs.json()) as TtsInvocationListData;
    expect(failLogsBody.items.length).toBeGreaterThanOrEqual(1);

    expect(
      (
        await app.request(`/api/admin/articles/${article.id}`, {
          method: 'PATCH',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: 'Hello audio body changed.' }),
        })
      ).status,
    ).toBe(200);
    const staleDetail = await app.request(`/api/admin/articles/${article.id}`, {
      headers: { Cookie: admin.cookie },
    });
    expect(((await staleDetail.json()) as AdminArticle).derivedFreshness.audio).toBe('stale');

    await db.delete(ttsInvocationLogTable).where(eq(ttsInvocationLogTable.articleId, article.id));
    await db.delete(articleAudioTable).where(eq(articleAudioTable.articleId, article.id));
    await db.delete(articleTable).where(eq(articleTable.id, article.id));

    synthesizeSpy.mockRestore();
    redisSpy.mockRestore();
    resetObjectStoreCache();
  });
});
