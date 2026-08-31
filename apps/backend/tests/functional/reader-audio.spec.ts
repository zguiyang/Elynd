import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
  ttsConfig as ttsConfigTable,
  user as userTable,
} from '@gloaming/db';
import { audioKindForRole } from '@gloaming/shared/api/content-assets';
import type { ReaderAudioTrack, ReaderPartData } from '@gloaming/shared/api/reader';
import type { AdminWork } from '@gloaming/shared/api/works';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import { processPartAudioGenerate } from '@/jobs/part-audio-generate';
import * as audioConcat from '@/lib/audio-concat';
import { encryptApiKey } from '@/lib/llm';
import * as queueLib from '@/lib/queue';
import * as redisLib from '@/lib/redis';
import * as azureTts from '@/lib/tts/azure';
import { partAudioObjectKey, partAudioSegmentKey } from '@/modules/content-assets/service';
import { resetObjectStoreCache, setObjectStoreForTests } from '@/modules/oss';
import { TTS_CONFIG_ID } from '@/modules/tts/service';
import { hashPartContent } from '@/modules/works/content-hash';

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

describe('learner part audio', () => {
  it('exposes DB-derived availability; missing chapter fails on asset GetObject only', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    await ensureTtsConfig();

    const create = await app.request('/api/admin/works', {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Listen Title',
        body: 'Listen body here.',
      }),
    });
    expect(create.status).toBe(201);
    const work = (await create.json()) as AdminWork;
    const partId = work.parts[0]!.id;

    expect(
      (
        await app.request(`/api/admin/works/${work.id}`, {
          method: 'PATCH',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceNote: 'demo', tags: ['daily'] }),
        })
      ).status,
    ).toBe(200);

    const memoryRedis = createMemoryRedis();
    const objectStore = createMemoryObjectStore();
    setObjectStoreForTests(objectStore);
    const redisSpy = vi.spyOn(redisLib, 'getRedis').mockReturnValue(memoryRedis.client as never);
    vi.spyOn(azureTts, 'synthesizeAzureTts').mockImplementation(async (input) => ({
      audio: Buffer.from(`mp3-${input.voice}`),
      mimeType: 'audio/mpeg',
      wordTimings: [{ text: 'Listen', audioOffsetMs: 0, durationMs: 100, textOffset: 0 }],
    }));
    vi.spyOn(audioConcat, 'concatMp3Buffers').mockImplementation(async (parts) => Buffer.concat(parts));
    vi.spyOn(queueLib, 'enqueue').mockImplementation(async (name, data) => {
      if (name === 'part-audio-generate') {
        await processPartAudioGenerate(data as Parameters<typeof processPartAudioGenerate>[0]);
      }
      return `job-${Date.now()}`;
    });

    const draftAudio = await app.request(`/api/reader/parts/${partId}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(draftAudio.status).toBe(404);

    expect(
      (
        await app.request(`/api/admin/works/${work.id}/publish`, {
          method: 'POST',
          headers: { Cookie: admin.cookie },
        })
      ).status,
    ).toBe(200);

    async function partAudioAvail(): Promise<ReaderPartData['audioAvailable']> {
      const res = await app.request(`/api/reader/parts/${partId}`, {
        headers: { Cookie: learner.cookie },
      });
      expect(res.status).toBe(200);
      return ((await res.json()) as ReaderPartData).audioAvailable;
    }

    expect(await partAudioAvail()).toEqual({ us: false, uk: false });

    expect(
      (
        await app.request(`/api/admin/parts/${partId}/audio/generate`, {
          method: 'POST',
          headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      ).status,
    ).toBe(200);

    expect(await partAudioAvail()).toEqual({ us: true, uk: true });

    const usTrack = await app.request(`/api/reader/parts/${partId}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(usTrack.status).toBe(200);
    const usBody = (await usTrack.json()) as ReaderAudioTrack;
    expect(usBody.role).toBe('us');
    expect(usBody.voice).toBe('en-US-GuyNeural');
    expect(usBody.audioUrl).toMatch(/^\/api\/assets\//);
    expect(usBody.assetId).toBeTruthy();
    expect(usBody.wordTimings.length).toBeGreaterThan(0);
    expect(usBody.wordTimings[0]).toMatchObject({
      text: 'Listen',
      audioOffsetMs: 0,
      durationMs: 100,
      textOffset: 0,
    });

    const contentHash = hashPartContent('Listen Title', 'Listen body here.');

    // Segments are not required for playback — only storageKey (chapter) is streamed.
    objectStore.store.delete(partAudioSegmentKey(partId, audioKindForRole('us'), contentHash, 0));
    expect(await partAudioAvail()).toEqual({ us: true, uk: true });
    expect((await app.request(`/api/assets/${usBody.assetId}`, { headers: { Cookie: learner.cookie } })).status).toBe(
      200,
    );

    const ukChapterKey = partAudioObjectKey(partId, audioKindForRole('uk'), contentHash);
    objectStore.store.delete(ukChapterKey);

    // P3: missing chapter does not affect DB-derived availability / track metadata.
    const ukTrackAfterDelete = await app.request(`/api/reader/parts/${partId}/audio?role=uk`, {
      headers: { Cookie: learner.cookie },
    });
    expect(ukTrackAfterDelete.status).toBe(200);
    const ukTrackBody = (await ukTrackAfterDelete.json()) as ReaderAudioTrack;
    expect(ukTrackBody.assetId).toBeTruthy();

    expect(await partAudioAvail()).toEqual({ us: true, uk: true });

    expect(
      (await app.request(`/api/assets/${ukTrackBody.assetId}`, { headers: { Cookie: learner.cookie } })).status,
    ).toBe(404);

    // us chapter still present — independent of uk object loss
    const usStillOk = await app.request(`/api/reader/parts/${partId}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(usStillOk.status).toBe(200);
    const usStillBody = (await usStillOk.json()) as ReaderAudioTrack;
    expect(
      (await app.request(`/api/assets/${usStillBody.assetId}`, { headers: { Cookie: learner.cookie } })).status,
    ).toBe(200);

    // Parts are read-only now — simulate content change directly in the DB
    // to verify audio invalidation (hash is based on extracted plain text).
    await db.update(readingPartTable).set({ body: 'Listen body changed.' }).where(eq(readingPartTable.id, partId));

    expect(await partAudioAvail()).toEqual({ us: false, uk: false });

    const staleTrack = await app.request(`/api/reader/parts/${partId}/audio?role=us`, {
      headers: { Cookie: learner.cookie },
    });
    expect(staleTrack.status).toBe(404);

    await db.delete(readingWorkTable).where(eq(readingWorkTable.id, work.id));
    redisSpy.mockRestore();
    vi.restoreAllMocks();
    resetObjectStoreCache();
  });
});
