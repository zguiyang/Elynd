import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { article as articleTable, user as userTable } from '@gloaming/db';
import type { Article } from '@gloaming/shared/api/articles';
import type { LearnPracticeData, PracticeAttempt, PracticeFeedbackResponse } from '@gloaming/shared/api/learn';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
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

describe('Practice attempt feedback HTTP', () => {
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

  it('returns AI advice for a completed attempt; rejects in-progress and other users', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    const other = await createSession('user');
    createdEmails.push(admin.email, learner.email, other.email);

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Quiet Harbor',
        body: 'Boats rest in the harbor.\n\nGulls wait for crumbs.',
        level: 'easy',
        themes: ['story'],
        sourceNote: 'demo',
      }),
    });
    expect(create.status).toBe(201);
    const article = (await create.json()) as Article;
    createdArticleIds.push(article.id);

    await app.request(`/api/admin/articles/${article.id}/publish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });

    const putPractice = await app.request(`/api/admin/articles/${article.id}/practice-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        items: [
          {
            kind: 'comprehension',
            payload: {
              prompt: '船停在哪里？',
              options: ['港口', '天空', '森林'],
            },
            correctOptionIndex: 0,
          },
        ],
      }),
    });
    expect(putPractice.status).toBe(200);

    const practiceGet = await app.request(`/api/learn/articles/${article.id}/practice`, {
      headers: { cookie: learner.cookie },
    });
    const practiceData = (await practiceGet.json()) as LearnPracticeData;
    const start = await app.request(`/api/learn/articles/${article.id}/practice/attempts`, {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    const attempt = (await start.json()) as PracticeAttempt;

    const inProgressFeedback = await app.request(
      `/api/learn/articles/${article.id}/practice/attempts/${attempt.id}/feedback`,
      { method: 'POST', headers: { cookie: learner.cookie } },
    );
    expect(inProgressFeedback.status).toBe(400);

    const complete = await app.request(`/api/learn/articles/${article.id}/practice/attempts/${attempt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({
        currentIndex: 0,
        status: 'completed',
        answers: [{ practiceItemId: practiceData.items[0]!.id, selectedOptionIndex: 1 }],
      }),
    });
    expect(complete.status).toBe(200);

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: JSON.stringify({ advice: '先回看港口那一句，对照你选的选项就好。' }),
      model: { rowId: 'mock-model', label: 'mock', modelId: 'mock' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

    try {
      const feedback = await app.request(`/api/learn/articles/${article.id}/practice/attempts/${attempt.id}/feedback`, {
        method: 'POST',
        headers: { cookie: learner.cookie },
      });
      expect(feedback.status).toBe(200);
      const body = (await feedback.json()) as PracticeFeedbackResponse;
      expect(body.advice).toContain('港口');
      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'practiceFeedback',
          source: 'practice.feedback',
          thinking: 'disabled',
        }),
      );
      expect(invokeSpy.mock.calls[0]?.[0]).not.toHaveProperty('outputSchema');

      const otherTouch = await app.request(
        `/api/learn/articles/${article.id}/practice/attempts/${attempt.id}/feedback`,
        { method: 'POST', headers: { cookie: other.cookie } },
      );
      expect(otherTouch.status).toBe(404);
    } finally {
      invokeSpy.mockRestore();
    }
  });
});
