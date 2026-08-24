import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  article as articleTable,
  articleAudio as articleAudioTable,
  ttsConfig as ttsConfigTable,
  user as userTable,
} from '@gloaming/db';
import type { ReaderAudioTrack, ReaderSessionData } from '@gloaming/shared/api/reader';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

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
      apiKeyCiphertext: encryptApiKey('learn-audio-test-key'),
      isEnabled: true,
      defaultVoice: 'en-US-JennyNeural',
      usVoice: 'en-US-GuyNeural',
      ukVoice: 'en-GB-SoniaNeural',
    })
    .onConflictDoUpdate({
      target: ttsConfigTable.id,
      set: {
        region: 'eastasia',
        apiKeyCiphertext: encryptApiKey('learn-audio-test-key'),
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

describe('learner article audio', () => {
  it('exposes availability and serves published fresh tracks only', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    await ensureTtsConfig();

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Listen Title',
        body: 'Listen body here.',
        level: 'easy',
        themes: ['daily'],
        sourceNote: 'demo',
        estimatedMinutes: 5,
      }),
    });
    expect(create.status).toBe(201);
    const article = (await create.json()) as { id: string };

    const memoryRedis = createMemoryRedis();
    const objectStore = createMemoryObjectStore();
    setObjectStoreForTests(objectStore);
    const redisSpy = vi.spyOn(redisLib, 'getRedis').mockReturnValue(memoryRedis.client as never);
    vi.spyOn(azureTts, 'synthesizeAzureTts').mockImplementation(async (input) => ({
      audio: Buffer.from(`mp3-${input.voice}`),
      mimeType: 'audio/mpeg',
      wordTimings: [{ text: 'Listen', audioOffsetMs: 0, durationMs: 100, textOffset: 0 }],
    }));

    const draftAudio = await app.request(`/api/reader/articles/${article.id}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(draftAudio.status).toBe(404);

    expect(
      (
        await app.request(`/api/admin/articles/${article.id}/publish`, {
          method: 'POST',
          headers: { Cookie: admin.cookie },
        })
      ).status,
    ).toBe(200);

    const before = await app.request(`/api/reader/articles/${article.id}`, {
      headers: { Cookie: learner.cookie },
    });
    expect(before.status).toBe(200);
    expect(((await before.json()) as ReaderSessionData).audioAvailable).toEqual({ us: false, uk: false });

    expect(
      (
        await app.request(`/api/admin/articles/${article.id}/audio/generate`, {
          method: 'POST',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(200);

    const after = await app.request(`/api/reader/articles/${article.id}`, {
      headers: { Cookie: learner.cookie },
    });
    expect(after.status).toBe(200);
    expect(((await after.json()) as ReaderSessionData).audioAvailable).toEqual({ us: true, uk: true });

    const usTrack = await app.request(`/api/reader/articles/${article.id}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(usTrack.status).toBe(200);
    const usBody = (await usTrack.json()) as ReaderAudioTrack;
    expect(usBody.role).toBe('us');
    expect(usBody.voice).toBe('en-US-GuyNeural');
    expect(usBody.audioBase64).toBeTruthy();
    expect(usBody.wordTimings.length).toBeGreaterThan(0);
    expect(usBody.wordTimings[0]).toMatchObject({
      text: 'Listen',
      audioOffsetMs: 0,
      durationMs: 100,
      textOffset: 0,
    });

    const contentHash = hashArticleContent('Listen Title', 'Listen body here.');
    objectStore.store.delete(articleAudioObjectKey(article.id, 'uk', contentHash));
    const ukGone = await app.request(`/api/reader/articles/${article.id}/audio?role=uk`, {
      headers: { Cookie: learner.cookie },
    });
    expect(ukGone.status).toBe(404);

    const avail = await app.request(`/api/reader/articles/${article.id}`, {
      headers: { Cookie: learner.cookie },
    });
    expect(((await avail.json()) as ReaderSessionData).audioAvailable).toEqual({ us: true, uk: false });

    expect(
      (
        await app.request(`/api/admin/articles/${article.id}`, {
          method: 'PATCH',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: 'Listen body changed.' }),
        })
      ).status,
    ).toBe(200);

    const staleAvail = await app.request(`/api/reader/articles/${article.id}`, {
      headers: { Cookie: learner.cookie },
    });
    expect(((await staleAvail.json()) as ReaderSessionData).audioAvailable).toEqual({ us: false, uk: false });

    const staleTrack = await app.request(`/api/reader/articles/${article.id}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(staleTrack.status).toBe(404);

    await db.delete(articleAudioTable).where(eq(articleAudioTable.articleId, article.id));
    await db.delete(articleTable).where(eq(articleTable.id, article.id));
    redisSpy.mockRestore();
    vi.restoreAllMocks();
    resetObjectStoreCache();
  });
});
