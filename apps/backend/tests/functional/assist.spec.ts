import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { article as articleTable, user as userTable } from '@elynd/db';
import { ASSIST_SSE_EVENT, type AssistSseDone, type AssistSseError } from '@elynd/shared/api/assist';

import app from '@/app';
import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import * as aiService from '@/modules/ai/service';

const password = 'password123';

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

async function signInEmail(email: string) {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email, password }),
  });
}

async function createSession() {
  const email = uniqueEmail('assist');
  const username = `assist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  expect((await signUp({ email, username, name: 'assist' })).status).toBe(200);
  await markEmailVerified(email);
  const login = await signInEmail(email);
  expect(login.status).toBe(200);
  return { email, cookie: cookieHeader(login) };
}

type ParsedSse = { event?: string; data: string };

function parseSseBlocks(raw: string): ParsedSse[] {
  const blocks = raw
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }
    return { event, data: dataLines.join('\n') };
  });
}

describe('Assist HTTP', () => {
  const createdEmails: string[] = [];
  const createdArticleIds: string[] = [];

  afterAll(async () => {
    if (createdArticleIds.length > 0) {
      await db.delete(articleTable).where(inArray(articleTable.id, createdArticleIds));
    }
    for (const email of createdEmails) {
      await db.delete(userTable).where(eq(userTable.email, email));
    }
  });

  it('streams assist reply via ai.stream and surfaces AI errors as SSE error events', async () => {
    const user = await createSession();
    createdEmails.push(user.email);

    const articleId = `art_${Date.now().toString(36)}`;
    createdArticleIds.push(articleId);
    await db.insert(articleTable).values({
      id: articleId,
      title: 'Assist Test',
      body: 'The fox jumped over the lazy dog near the river.',
      level: 'easy',
      themes: ['test'],
      status: 'published',
      publishedAt: new Date(),
    });

    async function* okStream(): AsyncGenerator<aiService.AiStreamEvent> {
      yield { type: 'delta', text: '狐狸' };
      yield { type: 'delta', text: '跳过了懒狗。' };
      yield {
        type: 'done',
        content: '狐狸跳过了懒狗。',
        model: { rowId: 'm1', label: 'Test', modelId: 'gpt-test' },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    }

    const streamSpy = vi.spyOn(aiService, 'streamAi').mockImplementation(() => okStream());

    const ok = await app.request('/api/assist/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', cookie: user.cookie },
      body: JSON.stringify({
        articleId,
        actionId: 'meaning',
        selection: 'The fox jumped over the lazy dog',
      }),
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type') ?? '').toContain('text/event-stream');
    const okBody = await ok.text();
    const okEvents = parseSseBlocks(okBody);
    expect(okEvents.map((e) => e.event)).toEqual([
      ASSIST_SSE_EVENT.delta,
      ASSIST_SSE_EVENT.delta,
      ASSIST_SSE_EVENT.done,
    ]);
    const done = JSON.parse(okEvents[2]!.data) as AssistSseDone;
    expect(done.reply).toContain('狐狸');
    expect(done.model?.label).toBe('Test');
    expect(streamSpy).toHaveBeenCalled();

    async function* failStream(): AsyncGenerator<aiService.AiStreamEvent> {
      throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable');
      yield { type: 'delta', text: '' }; // unreachable — keeps generator typing
    }

    streamSpy.mockImplementation(() => failStream());
    const unavailable = await app.request('/api/assist/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', cookie: user.cookie },
      body: JSON.stringify({
        articleId,
        actionId: 'meaning',
        selection: 'The fox jumped over the lazy dog',
      }),
    });
    expect(unavailable.status).toBe(200);
    const errEvents = parseSseBlocks(await unavailable.text());
    expect(errEvents.some((e) => e.event === ASSIST_SSE_EVENT.error)).toBe(true);
    const errPayload = JSON.parse(errEvents.find((e) => e.event === ASSIST_SSE_EVENT.error)!.data) as AssistSseError;
    expect(errPayload.error).toMatch(/AI unavailable|Article/i);
    streamSpy.mockRestore();
  });
});
