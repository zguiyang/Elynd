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
import type { TtsInvocationListData, TtsInvocationStats } from '@elynd/shared/api/tts-invocations';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import { encryptApiKey } from '@/lib/llm';
import * as redisLib from '@/lib/redis';
import * as azureTts from '@/lib/tts/azure';
import { TTS_CONFIG_ID } from '@/modules/tts/service';

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
});

describe('admin article audio', () => {
  it('generates, serves, regenerates, marks expired, and filters logs', async () => {
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
    const article = (await create.json()) as { id: string };

    const memory = createMemoryRedis();
    const redisSpy = vi.spyOn(redisLib, 'getRedis').mockReturnValue(memory.client as never);
    const synthesizeSpy = vi.spyOn(azureTts, 'synthesizeAzureTts').mockResolvedValue({
      audio: Buffer.from('article-mp3-v1'),
      mimeType: 'audio/mpeg',
      wordTimings: [{ text: 'Hello', audioOffsetMs: 0, durationMs: 100, textOffset: 0 }],
    });

    const empty = await app.request(`/api/admin/articles/${article.id}/audio`, {
      headers: { Cookie: admin.cookie },
    });
    expect(empty.status).toBe(200);
    const emptyBody = (await empty.json()) as ArticleAudioView;
    expect(emptyBody.status).toBe('none');
    expect(emptyBody.audioAvailable).toBe(false);

    const generated = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'us' }),
    });
    expect(generated.status).toBe(200);
    const generatedBody = (await generated.json()) as GenerateArticleAudioResult;
    expect(generatedBody.status).toBe('ready');
    expect(generatedBody.voice).toBe('en-US-GuyNeural');
    expect(generatedBody.role).toBe('us');
    expect(generatedBody.audioAvailable).toBe(true);
    expect(generatedBody.audioBase64).toBe(Buffer.from('article-mp3-v1').toString('base64'));
    expect(generatedBody.cached).toBe(false);
    expect(synthesizeSpy).toHaveBeenCalledTimes(1);
    expect(memory.store.has(`elynd:article-audio:v1:${article.id}`)).toBe(true);

    const metaRows = await db
      .select()
      .from(articleAudioTable)
      .where(eq(articleAudioTable.articleId, article.id))
      .limit(1);
    expect(metaRows[0]?.status).toBe('ready');

    const logs = await app.request('/api/admin/tts/invocations?pageSize=20&status=success', {
      headers: { Cookie: admin.cookie },
    });
    expect(logs.status).toBe(200);
    const logsBody = (await logs.json()) as TtsInvocationListData;
    expect(logsBody.items.some((item) => item.articleId === article.id && item.source === 'admin.article_audio')).toBe(
      true,
    );

    const stats = await app.request('/api/admin/tts/invocations/stats', {
      headers: { Cookie: admin.cookie },
    });
    expect(stats.status).toBe(200);
    const statsBody = (await stats.json()) as TtsInvocationStats;
    expect(statsBody.successCount).toBeGreaterThanOrEqual(1);

    synthesizeSpy.mockResolvedValue({
      audio: Buffer.from('article-mp3-v2'),
      mimeType: 'audio/mpeg',
      wordTimings: [{ text: 'Hello', audioOffsetMs: 0, durationMs: 110, textOffset: 0 }],
    });
    const regenerated = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(regenerated.status).toBe(200);
    const regeneratedBody = (await regenerated.json()) as GenerateArticleAudioResult;
    expect(regeneratedBody.audioBase64).toBe(Buffer.from('article-mp3-v2').toString('base64'));
    expect(regeneratedBody.voice).toBe('en-US-JennyNeural');

    memory.store.delete(`elynd:article-audio:v1:${article.id}`);
    const expired = await app.request(`/api/admin/articles/${article.id}/audio`, {
      headers: { Cookie: admin.cookie },
    });
    expect(expired.status).toBe(200);
    const expiredBody = (await expired.json()) as ArticleAudioView;
    expect(expiredBody.status).toBe('ready');
    expect(expiredBody.expired).toBe(true);
    expect(expiredBody.audioAvailable).toBe(false);

    synthesizeSpy.mockRejectedValueOnce(new Error('azure down'));
    const failed = await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'uk' }),
    });
    expect(failed.status).toBe(503);
    const afterFailMeta = await db
      .select()
      .from(articleAudioTable)
      .where(eq(articleAudioTable.articleId, article.id))
      .limit(1);
    expect(afterFailMeta[0]?.status).toBe('ready');
    expect(afterFailMeta[0]?.lastError).toContain('azure down');

    const failLogs = await app.request(
      `/api/admin/tts/invocations?status=failure&articleId=${encodeURIComponent(article.id)}`,
      { headers: { Cookie: admin.cookie } },
    );
    expect(failLogs.status).toBe(200);
    const failLogsBody = (await failLogs.json()) as TtsInvocationListData;
    expect(failLogsBody.items.length).toBeGreaterThanOrEqual(1);

    await db.delete(ttsInvocationLogTable).where(eq(ttsInvocationLogTable.articleId, article.id));
    await db.delete(articleAudioTable).where(eq(articleAudioTable.articleId, article.id));
    await db.delete(articleTable).where(eq(articleTable.id, article.id));

    synthesizeSpy.mockRestore();
    redisSpy.mockRestore();
  });
});
