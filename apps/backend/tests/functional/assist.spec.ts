import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { article as articleTable, user as userTable } from '@elynd/db';
import type { AssistAskData } from '@elynd/shared/api/assist';

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

  it('returns assist reply via ai.invoke and degrades when AI unavailable', async () => {
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

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: { reply: '狐狸跳过了懒狗。' },
      model: { rowId: 'm1', label: 'Test', modelId: 'gpt-test' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const ok = await app.request('/api/assist/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({
        articleId,
        actionId: 'meaning',
        selection: 'The fox jumped over the lazy dog',
      }),
    });
    expect(ok.status).toBe(200);
    const data = (await ok.json()) as AssistAskData;
    expect(data.reply).toContain('狐狸');
    expect(data.model?.label).toBe('Test');
    expect(invokeSpy).toHaveBeenCalled();

    invokeSpy.mockRejectedValueOnce(new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable'));
    const unavailable = await app.request('/api/assist/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({
        articleId,
        actionId: 'meaning',
        selection: 'The fox jumped over the lazy dog',
      }),
    });
    expect(unavailable.status).toBe(503);
    invokeSpy.mockRestore();
  });
});
