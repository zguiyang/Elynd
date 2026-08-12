import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { article as articleTable, user as userTable } from '@elynd/db';
import type { Article } from '@elynd/shared/api/articles';
import type {
  AdminPracticeItemsData,
  LearnArticleData,
  LearnPracticeData,
  LearnTodayData,
  PracticeAttempt,
  ReadingProgress,
} from '@elynd/shared/api/learn';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

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

  it('supports room progress, curated practice, and today resume', async () => {
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

    const putPractice = await app.request(`/api/admin/articles/${article.id}/practice-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        items: [
          {
            kind: 'comprehension',
            payload: {
              prompt: 'What is the main idea?',
              options: ['Seas are empty', 'Seas hold hidden life', 'Seas are dry'],
            },
            correctOptionIndex: 1,
          },
          {
            kind: 'vocab',
            payload: {
              word: 'hides',
              hint: 'In this text…',
              quote: 'Life hides below.',
              options: ['conceals', 'shouts', 'melts', 'counts'],
            },
            correctOptionIndex: 0,
          },
        ],
      }),
    });
    expect(putPractice.status).toBe(200);
    const adminItems = (await putPractice.json()) as AdminPracticeItemsData;
    expect(adminItems.items).toHaveLength(2);
    expect(adminItems.items[0]?.correctOptionIndex).toBe(1);

    const room = await app.request(`/api/learn/articles/${article.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(room.status).toBe(200);
    const roomData = (await room.json()) as LearnArticleData;
    expect(roomData.practiceAvailable).toBe(true);
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

    const practiceGet = await app.request(`/api/learn/articles/${article.id}/practice`, {
      headers: { cookie: learner.cookie },
    });
    expect(practiceGet.status).toBe(200);
    const practiceData = (await practiceGet.json()) as LearnPracticeData;
    expect(practiceData.items).toHaveLength(2);
    expect(practiceData.items[0]).not.toHaveProperty('correctOptionIndex');
    expect(practiceData.attempt).toBeNull();

    const start = await app.request(`/api/learn/articles/${article.id}/practice/attempts`, {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    expect(start.status).toBe(200);
    const attempt = (await start.json()) as PracticeAttempt;
    expect(attempt.status).toBe('in_progress');

    const resume = await app.request(`/api/learn/articles/${article.id}/practice/attempts`, {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    expect(resume.status).toBe(200);
    expect(((await resume.json()) as PracticeAttempt).id).toBe(attempt.id);

    const answer = await app.request(`/api/learn/articles/${article.id}/practice/attempts/${attempt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({
        currentIndex: 1,
        answers: [{ practiceItemId: practiceData.items[0]!.id, selectedOptionIndex: 1 }],
      }),
    });
    expect(answer.status).toBe(200);

    const todayWithPractice = await app.request('/api/learn/today', {
      headers: { cookie: learner.cookie },
    });
    const todayPractice = (await todayWithPractice.json()) as LearnTodayData;
    expect(todayPractice.activePractice?.attemptId).toBe(attempt.id);

    const skip = await app.request(`/api/learn/articles/${article.id}/practice/attempts/${attempt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ status: 'skipped' }),
    });
    expect(skip.status).toBe(200);
    expect(((await skip.json()) as PracticeAttempt).status).toBe('skipped');

    const todayAfterSkip = await app.request('/api/learn/today', {
      headers: { cookie: learner.cookie },
    });
    expect(((await todayAfterSkip.json()) as LearnTodayData).activePractice).toBeNull();

    const otherLearner = await createSession('user');
    createdEmails.push(otherLearner.email);
    const otherTouch = await app.request(`/api/learn/articles/${article.id}/practice/attempts/${attempt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: otherLearner.cookie },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(otherTouch.status).toBe(404);
  });

  it('allows published articles without practice items', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Pure Read',
        body: 'Just reading.',
        themes: ['story'],
        sourceNote: 'demo',
      }),
    });
    const article = (await create.json()) as Article;
    createdArticleIds.push(article.id);
    expect(
      (
        await app.request(`/api/admin/articles/${article.id}/publish`, {
          method: 'POST',
          headers: { cookie: admin.cookie },
        })
      ).status,
    ).toBe(200);

    const room = await app.request(`/api/learn/articles/${article.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(room.status).toBe(200);
    expect(((await room.json()) as LearnArticleData).practiceAvailable).toBe(false);

    const start = await app.request(`/api/learn/articles/${article.id}/practice/attempts`, {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    expect(start.status).toBe(404);
  });
});
