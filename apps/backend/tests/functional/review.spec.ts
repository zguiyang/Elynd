import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { article as articleTable, reviewSession as reviewSessionTable, user as userTable } from '@elynd/db';
import type { Article } from '@elynd/shared/api/articles';
import type {
  AdminReviewItemsData,
  GenerateReviewItemsResponse,
  ReviewAnswerResponse,
  ReviewFeedbackResponse,
  ReviewTodayData,
} from '@elynd/shared/api/review';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

import app from '@/app';
import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { JOB_REVIEW_MATERIALIZE } from '@/jobs/review-materialize';
import { closeQueue, getQueue } from '@/lib/queue';
import * as aiService from '@/modules/ai/service';
import { materializeDailyReview } from '@/modules/review/service';

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

async function createSession(role: 'user' | 'admin') {
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

async function createPublishedArticle(adminCookie: string, title: string): Promise<Article> {
  const create = await app.request('/api/admin/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      title,
      body: 'The ocean is full of mysteries.\n\nA warm current carries nutrients.',
      level: 'mid',
      themes: ['science'],
      sourceNote: 'demo',
      estimatedMinutes: 6,
    }),
  });
  expect(create.status).toBe(201);
  const article = (await create.json()) as Article;

  const publish = await app.request(`/api/admin/articles/${article.id}/publish`, {
    method: 'POST',
    headers: { cookie: adminCookie },
  });
  expect(publish.status).toBe(200);
  return article;
}

const bankItems = [
  {
    kind: 'cloze' as const,
    sentence: 'The ocean is full of mysteries.',
    focus: 'mysteries',
    options: ['trenches', 'mysteries'],
    hintZh: '说不清的事。',
    correctOptionIndex: 1,
  },
  {
    kind: 'sense' as const,
    sentence: 'A warm current carries nutrients.',
    focus: 'current',
    options: ['现在', '洋流'],
    hintZh: '洋流。',
    correctOptionIndex: 1,
  },
];

describe('Review HTTP', () => {
  const createdEmails: string[] = [];
  const createdArticleIds: string[] = [];

  afterAll(async () => {
    if (createdArticleIds.length > 0) {
      await db.delete(articleTable).where(inArray(articleTable.id, createdArticleIds));
    }
    for (const email of createdEmails) {
      await db.delete(userTable).where(eq(userTable.email, email));
    }
    await closeQueue();
  });

  it('returns need_completion until a short article is marked completed', async () => {
    const learner = await createSession('user');
    createdEmails.push(learner.email);

    const anonymous = await app.request('/api/review/today');
    expect(anonymous.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    const today = await app.request('/api/review/today', { headers: { cookie: learner.cookie } });
    expect(today.status).toBe(200);
    const body = (await today.json()) as ReviewTodayData;
    expect(body.queueStatus).toBe('need_completion');
    expect(body.items).toEqual([]);
    expect(body.result).toBeNull();
  });

  it('saves an admin review bank and drafts generate without writing rows', async () => {
    const admin = await createSession('admin');
    createdEmails.push(admin.email);
    const article = await createPublishedArticle(admin.cookie, 'Review Bank Harbor');
    createdArticleIds.push(article.id);

    const put = await app.request(`/api/admin/articles/${article.id}/review-items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({ items: bankItems }),
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()) as AdminReviewItemsData;
    expect(saved.items).toHaveLength(2);
    expect(saved.items[0]?.correctOptionIndex).toBe(1);

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            kind: 'cloze',
            sentence: 'The ocean is full of mysteries.',
            focus: 'mysteries',
            options: ['trenches', 'mysteries', 'plants'],
            hintZh: '说不清的事。',
            correctOptionIndex: 1,
          },
        ],
      }),
      model: { rowId: 'mock-model', label: 'mock', modelId: 'mock' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

    try {
      const generate = await app.request(`/api/admin/articles/${article.id}/review-items/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({}),
      });
      expect(generate.status).toBe(200);
      const draft = (await generate.json()) as GenerateReviewItemsResponse;
      expect(draft.items).toHaveLength(1);
      expect(draft.items[0]?.kind).toBe('cloze');
      expect(draft.items[0]?.options[draft.items[0]!.correctOptionIndex]).toBe('mysteries');
      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'practice',
          source: 'review.generate',
          thinking: 'disabled',
        }),
      );
    } finally {
      invokeSpy.mockRestore();
    }

    const messySpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            kind: 'cloze',
            sentence: 'The secondhand store smelled like old books and clean soap.',
            focus: 'secondhand',
            options: [
              'modern',
              'secondhand',
              'expensive',
              'brand-new',
              'unused-and-still-in-the-original-packaging-from-the-factory-floor',
            ],
            hint: '别人用过的。',
            correctIndex: '1',
          },
        ],
      }),
      model: { rowId: 'mock-model', label: 'mock', modelId: 'mock' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

    try {
      const generate = await app.request(`/api/admin/articles/${article.id}/review-items/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({}),
      });
      expect(generate.status).toBe(200);
      const draft = (await generate.json()) as GenerateReviewItemsResponse;
      expect(draft.items).toHaveLength(1);
      expect(draft.items[0]?.kind).toBe('cloze');
      expect(draft.items[0]?.options).toHaveLength(4);
      expect(draft.items[0]?.hintZh).toBe('别人用过的。');
      expect(draft.items[0]?.options[draft.items[0]!.correctOptionIndex]).toBe('secondhand');
    } finally {
      messySpy.mockRestore();
    }
  });

  it('materializes a daily queue and scores answers on the server', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);
    const article = await createPublishedArticle(admin.cookie, 'Review Queue Sea');
    createdArticleIds.push(article.id);

    await app.request(`/api/learn/articles/${article.id}`, { headers: { cookie: learner.cookie } });
    const completeBeforeBank = await app.request(`/api/learn/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(completeBeforeBank.status).toBe(200);

    const empty = await app.request('/api/review/today', { headers: { cookie: learner.cookie } });
    expect(((await empty.json()) as ReviewTodayData).queueStatus).toBe('empty');

    expect(
      (
        await app.request(`/api/admin/articles/${article.id}/review-items`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
          body: JSON.stringify({ items: bankItems }),
        })
      ).status,
    ).toBe(200);

    const ready = await app.request('/api/review/today', { headers: { cookie: learner.cookie } });
    expect(ready.status).toBe(200);
    const readyBody = (await ready.json()) as ReviewTodayData;
    expect(readyBody.queueStatus).toBe('ready');
    expect(readyBody.items).toHaveLength(2);
    expect(readyBody.result).toBeNull();
    expect(readyBody.items[0]).not.toHaveProperty('correctIndex');
    expect(readyBody.items[0]).not.toHaveProperty('correctOptionIndex');

    const miss = await app.request('/api/review/today/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ itemId: readyBody.items[0]!.id, selectedIndex: 0 }),
    });
    expect(miss.status).toBe(200);
    const missBody = (await miss.json()) as ReviewAnswerResponse;
    expect(missBody.isHit).toBe(false);
    expect(missBody.hint).toContain('不是');
    expect(missBody.queueStatus).toBe('ready');
    expect(missBody.result).toBeNull();

    const tooEarlyFeedback = await app.request('/api/review/today/feedback', {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    expect(tooEarlyFeedback.status).toBe(HTTP_STATUS.BAD_REQUEST);

    const [learnerRow] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, learner.email));
    const [sessionAfterFirst] = await db
      .select({ id: reviewSessionTable.id })
      .from(reviewSessionTable)
      .where(eq(reviewSessionTable.userId, learnerRow!.id));

    await materializeDailyReview({ mode: 'cron' });
    const [sessionAfterCron] = await db
      .select({ id: reviewSessionTable.id })
      .from(reviewSessionTable)
      .where(eq(reviewSessionTable.userId, learnerRow!.id));
    expect(sessionAfterCron?.id).toBe(sessionAfterFirst?.id);

    const hit = await app.request('/api/review/today/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ itemId: readyBody.items[1]!.id, selectedIndex: 1 }),
    });
    expect(hit.status).toBe(200);
    const hitBody = (await hit.json()) as ReviewAnswerResponse;
    expect(hitBody.queueStatus).toBe('done');
    expect(hitBody.result?.totalCount).toBe(2);
    expect(hitBody.result?.correctCount).toBe(1);
    expect(hitBody.result?.items[0]?.correctOptionIndex).toBe(1);
    expect(hitBody.result?.items[0]?.isCorrect).toBe(false);

    const done = await app.request('/api/review/today', { headers: { cookie: learner.cookie } });
    const doneBody = (await done.json()) as ReviewTodayData;
    expect(doneBody.queueStatus).toBe('done');
    expect(doneBody.outcome).toBe('completed');
    expect(doneBody.result?.totalCount).toBe(2);
    expect(doneBody.result?.correctCount).toBe(1);

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: JSON.stringify({ advice: '先回看海洋那一句，对照你选的选项就好。' }),
      model: { rowId: 'mock-model', label: 'mock', modelId: 'mock' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    try {
      const feedback = await app.request('/api/review/today/feedback', {
        method: 'POST',
        headers: { cookie: learner.cookie },
      });
      expect(feedback.status).toBe(200);
      const feedbackBody = (await feedback.json()) as ReviewFeedbackResponse;
      expect(feedbackBody.advice).toContain('海洋');
      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'practiceFeedback',
          source: 'review.feedback',
          thinking: 'disabled',
        }),
      );
    } finally {
      invokeSpy.mockRestore();
    }

    const beforeManual = await db
      .select({ id: reviewSessionTable.id, source: reviewSessionTable.source })
      .from(reviewSessionTable)
      .where(eq(reviewSessionTable.userId, learnerRow!.id));
    expect(beforeManual[0]?.source).toBe('cron');

    await materializeDailyReview({ mode: 'manual' });
    const afterManual = await db
      .select({ id: reviewSessionTable.id, source: reviewSessionTable.source, outcome: reviewSessionTable.outcome })
      .from(reviewSessionTable)
      .where(eq(reviewSessionTable.userId, learnerRow!.id));
    expect(afterManual).toHaveLength(1);
    expect(afterManual[0]?.id).not.toBe(beforeManual[0]?.id);
    expect(afterManual[0]?.source).toBe('manual');
    expect(afterManual[0]?.outcome).toBe('in_progress');

    const leave = await app.request('/api/review/today/leave', {
      method: 'POST',
      headers: { cookie: learner.cookie },
    });
    expect(leave.status).toBe(200);
    expect(((await leave.json()) as { queueStatus: string }).queueStatus).toBe('done');

    const resumed = await app.request('/api/review/today', { headers: { cookie: learner.cookie } });
    expect(resumed.status).toBe(200);
    const resumedBody = (await resumed.json()) as ReviewTodayData;
    expect(resumedBody.queueStatus).toBe('ready');

    const afterLeave = await app.request('/api/review/today/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ itemId: resumedBody.items[0]!.id, selectedIndex: 0 }),
    });
    expect(afterLeave.status).toBe(200);
  });

  it('enqueues materialize for admins with 202', async () => {
    const user = await createSession('user');
    const admin = await createSession('admin');
    createdEmails.push(user.email, admin.email);

    const anonymous = await app.request('/api/admin/review/materialize', { method: 'POST' });
    expect(anonymous.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    const forbidden = await app.request('/api/admin/review/materialize', {
      method: 'POST',
      headers: { cookie: user.cookie },
    });
    expect(forbidden.status).toBe(HTTP_STATUS.FORBIDDEN);

    const response = await app.request('/api/admin/review/materialize', {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(response.status).toBe(HTTP_STATUS.ACCEPTED);
    const body = (await response.json()) as { id?: string };
    expect(body.id).toBeTruthy();
    const job = await getQueue().getJob(body.id!);
    expect(job?.name).toBe(JOB_REVIEW_MATERIALIZE);
    expect(job?.data).toEqual({ mode: 'manual' });
  });
});
