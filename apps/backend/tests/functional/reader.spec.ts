import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { article as articleTable, user as userTable } from '@gloaming/db';
import type { Article } from '@gloaming/shared/api/articles';
import { type ReaderSessionData, type ReadingProgress } from '@gloaming/shared/api/reader';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';

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

describe('Reader HTTP', () => {
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

  it('supports reader session and monotonic progress updates', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Ocean Quiet',
        body: 'The sea is wide.\n\nLife hides below.',
        level: 'mid',
        themes: ['science'],
        sourceNote: 'demo',
        estimatedMinutes: 8,
      }),
    });
    expect(create.status).toBe(201);
    const article = (await create.json()) as Article;
    createdArticleIds.push(article.id);

    const publish = await app.request(`/api/admin/articles/${article.id}/publish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(publish.status).toBe(200);

    const session = await app.request(`/api/reader/articles/${article.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(session.status).toBe(200);
    const sessionData = (await session.json()) as ReaderSessionData;
    expect(sessionData.audioAvailable).toEqual({ us: false, uk: false });
    expect(sessionData.progress.status).toBe('in_progress');
    expect(sessionData.progress.progressRatio).toBe(0);

    const progressPatch = await app.request(`/api/reader/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ progressRatio: 40 }),
    });
    expect(progressPatch.status).toBe(200);
    const progress = (await progressPatch.json()) as ReadingProgress;
    expect(progress.progressRatio).toBe(40);

    const progressDown = await app.request(`/api/reader/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ progressRatio: 10 }),
    });
    expect(progressDown.status).toBe(200);
    expect(((await progressDown.json()) as ReadingProgress).progressRatio).toBe(40);
  });
});
