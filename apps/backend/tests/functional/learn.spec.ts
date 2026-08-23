import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { article as articleTable, user as userTable } from '@gloaming/db';
import type { Article } from '@gloaming/shared/api/articles';
import {
  LEARN_TODAY_RECOMMENDATIONS_LIMIT,
  type LearnArticleData,
  type LearnShelfData,
  type LearnTodayData,
  type ReadingProgress,
} from '@gloaming/shared/api/learn';
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

describe('Learn HTTP', () => {
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

  it('supports reader progress and today resume', async () => {
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

    const room = await app.request(`/api/learn/articles/${article.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(room.status).toBe(200);
    const roomData = (await room.json()) as LearnArticleData;
    expect(roomData.audioAvailable).toEqual({ us: false, uk: false });
    expect(roomData.progress.status).toBe('in_progress');
    expect(roomData.progress.progressRatio).toBe(0);

    const progressPatch = await app.request(`/api/learn/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ progressRatio: 40 }),
    });
    expect(progressPatch.status).toBe(200);
    const progress = (await progressPatch.json()) as ReadingProgress;
    expect(progress.progressRatio).toBe(40);

    const progressDown = await app.request(`/api/learn/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ progressRatio: 10 }),
    });
    expect(progressDown.status).toBe(200);
    expect(((await progressDown.json()) as ReadingProgress).progressRatio).toBe(40);

    const today = await app.request('/api/learn/today', {
      headers: { cookie: learner.cookie },
    });
    expect(today.status).toBe(200);
    const todayData = (await today.json()) as LearnTodayData;
    expect(todayData.current?.article.id).toBe(article.id);
    expect(todayData.current?.progress.progressRatio).toBe(40);
    expect(Array.isArray(todayData.recommendations)).toBe(true);
    expect(todayData.recommendations.some((row) => row.id === article.id)).toBe(false);
  });

  it('recommends unread published articles and excludes opened or draft ones', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    async function createAndPublish(title: string): Promise<Article> {
      const create = await app.request('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({
          title,
          body: `${title} body.`,
          level: 'mid',
          themes: ['science'],
          sourceNote: 'demo',
          estimatedMinutes: 5,
        }),
      });
      expect(create.status).toBe(201);
      const article = (await create.json()) as Article;
      expect(
        (
          await app.request(`/api/admin/articles/${article.id}/publish`, {
            method: 'POST',
            headers: { cookie: admin.cookie },
          })
        ).status,
      ).toBe(200);
      return article;
    }

    const unreadA = await createAndPublish('Unread Alpha');
    const unreadB = await createAndPublish('Unread Beta');
    const opened = await createAndPublish('Opened Gamma');
    createdArticleIds.push(unreadA.id, unreadB.id, opened.id);

    const draftCreate = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Draft Delta',
        body: 'Still a draft.',
        themes: ['story'],
        sourceNote: 'demo',
      }),
    });
    expect(draftCreate.status).toBe(201);
    const draft = (await draftCreate.json()) as Article;
    createdArticleIds.push(draft.id);

    expect(
      (await app.request(`/api/learn/articles/${opened.id}`, { headers: { cookie: learner.cookie } })).status,
    ).toBe(200);

    const today = await app.request('/api/learn/today', { headers: { cookie: learner.cookie } });
    expect(today.status).toBe(200);
    const body = (await today.json()) as LearnTodayData;
    expect(body.current?.article.id).toBe(opened.id);
    expect(body.recommendations.length).toBeLessThanOrEqual(LEARN_TODAY_RECOMMENDATIONS_LIMIT);
    const recIds = body.recommendations.map((row) => row.id);
    expect(recIds).not.toContain(opened.id);
    expect(recIds).not.toContain(draft.id);
    expect(recIds).toEqual(expect.arrayContaining([unreadA.id, unreadB.id]));
  });

  it('returns empty shelf, then current + items after reading', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    async function createAndPublish(title: string): Promise<Article> {
      const create = await app.request('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({
          title,
          body: `${title} body for shelf.`,
          level: 'easy',
          themes: ['story'],
          sourceNote: 'demo',
          estimatedMinutes: 4,
        }),
      });
      expect(create.status).toBe(201);
      const article = (await create.json()) as Article;
      expect(
        (
          await app.request(`/api/admin/articles/${article.id}/publish`, {
            method: 'POST',
            headers: { cookie: admin.cookie },
          })
        ).status,
      ).toBe(200);
      return article;
    }

    const emptyShelf = await app.request('/api/learn/shelf', { headers: { cookie: learner.cookie } });
    expect(emptyShelf.status).toBe(200);
    expect((await emptyShelf.json()) as LearnShelfData).toEqual({ current: null, items: [] });

    const first = await createAndPublish('Shelf First');
    const second = await createAndPublish('Shelf Second');
    createdArticleIds.push(first.id, second.id);

    expect((await app.request(`/api/learn/articles/${first.id}`, { headers: { cookie: learner.cookie } })).status).toBe(
      200,
    );
    expect(
      (
        await app.request(`/api/learn/articles/${first.id}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
          body: JSON.stringify({ status: 'completed', progressRatio: 100 }),
        })
      ).status,
    ).toBe(200);

    expect(
      (await app.request(`/api/learn/articles/${second.id}`, { headers: { cookie: learner.cookie } })).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/learn/articles/${second.id}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
          body: JSON.stringify({ progressRatio: 55 }),
        })
      ).status,
    ).toBe(200);

    const shelf = await app.request('/api/learn/shelf', { headers: { cookie: learner.cookie } });
    expect(shelf.status).toBe(200);
    const shelfData = (await shelf.json()) as LearnShelfData;
    expect(shelfData.current?.article.id).toBe(second.id);
    expect(shelfData.current?.progress.progressRatio).toBe(55);
    expect(shelfData.items).toHaveLength(1);
    expect(shelfData.items[0]?.article.id).toBe(first.id);
    expect(shelfData.items[0]?.progress.status).toBe('completed');
  });
});
