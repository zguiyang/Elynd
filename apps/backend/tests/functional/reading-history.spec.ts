import { randomUUID } from 'node:crypto';

import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { article as articleTable, readingProgress as readingProgressTable, user as userTable } from '@gloaming/db';
import type { Article } from '@gloaming/shared/api/articles';
import { calendarDateInTimeZone, type ReadingHistoryData } from '@gloaming/shared/api/reading-history';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import * as conversationsService from '@/modules/conversations/service';

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
  const cookie = cookieHeader(login);
  const me = await app.request('/api/me', { headers: { cookie } });
  expect(me.status).toBe(200);
  const user = (await me.json()) as { id: string };
  return { email, cookie, userId: user.id };
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

async function getReadingHistory(cookie: string): Promise<ReadingHistoryData> {
  const response = await app.request('/api/reading-history', { headers: { cookie } });
  expect(response.status).toBe(200);
  return (await response.json()) as ReadingHistoryData;
}

describe('Reading history HTTP', () => {
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

  it('requires a session and does not treat shelf as a reading-activity day', async () => {
    const anonymous = await app.request('/api/reading-history');
    expect(anonymous.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    const learner = await createSession('user');
    createdEmails.push(learner.email);

    expect((await app.request('/api/shelf', { headers: { cookie: learner.cookie } })).status).toBe(200);

    const empty = await getReadingHistory(learner.cookie);
    expect(empty.today).toBe(calendarDateInTimeZone());
    expect(empty.activity).toEqual([]);
    expect(empty.completions).toEqual([]);
    expect(empty.portrait).toEqual({
      consecutiveDays: 0,
      readingDays: 0,
      completedArticles: 0,
      lookedUpWords: 0,
    });
  });

  it('records reader opens, backfills recoverable dates, and lists completions', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);
    const article = await createPublishedArticle(admin.cookie, 'History Sea');
    createdArticleIds.push(article.id);

    const createdAt = new Date('2026-01-10T04:00:00.000Z');
    const lastReadAt = new Date('2026-01-15T04:00:00.000Z');
    await db.insert(readingProgressTable).values({
      id: randomUUID(),
      userId: learner.userId,
      articleId: article.id,
      status: 'in_progress',
      progressRatio: 20,
      createdAt,
      lastReadAt,
      completedAt: null,
    });

    const backfilled = await getReadingHistory(learner.cookie);
    expect(backfilled.activity.map((day) => day.date)).toEqual(
      expect.arrayContaining([calendarDateInTimeZone(createdAt), calendarDateInTimeZone(lastReadAt)]),
    );
    expect(backfilled.activity.some((day) => day.date === calendarDateInTimeZone())).toBe(false);

    expect(
      (await app.request(`/api/reader/articles/${article.id}`, { headers: { cookie: learner.cookie } })).status,
    ).toBe(200);
    const complete = await app.request(`/api/reader/articles/${article.id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: learner.cookie },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(complete.status).toBe(200);

    const today = calendarDateInTimeZone();
    const live = await getReadingHistory(learner.cookie);
    expect(live.activity.some((day) => day.date === today && day.level === 1)).toBe(true);
    expect(live.portrait.completedArticles).toBe(1);
    expect(live.portrait.readingDays).toBeGreaterThanOrEqual(2);
    expect(live.completions[0]).toMatchObject({ title: 'History Sea', articleId: article.id, date: today });
  });

  it('counts distinct lookup selections', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);
    const article = await createPublishedArticle(admin.cookie, 'History Lookups');
    createdArticleIds.push(article.id);

    expect(
      (await app.request(`/api/reader/articles/${article.id}`, { headers: { cookie: learner.cookie } })).status,
    ).toBe(200);

    await conversationsService.appendAssistTurn({
      userId: learner.userId,
      surface: 'assist-read',
      subjectType: 'article',
      subjectId: article.id,
      userContent: 'Ocean',
      assistantContent: '海。',
      assistantStatus: 'complete',
      userMetadata: { actionId: 'lookup', selection: 'Ocean' },
    });
    await conversationsService.appendAssistTurn({
      userId: learner.userId,
      surface: 'assist-read',
      subjectType: 'article',
      subjectId: article.id,
      userContent: 'ocean',
      assistantContent: '海。',
      assistantStatus: 'complete',
      userMetadata: { actionId: 'lookup', selection: ' ocean ' },
    });
    await conversationsService.appendAssistTurn({
      userId: learner.userId,
      surface: 'assist-read',
      subjectType: 'article',
      subjectId: article.id,
      userContent: 'current',
      assistantContent: '洋流。',
      assistantStatus: 'complete',
      userMetadata: { actionId: 'lookup', selection: 'current' },
    });
    await conversationsService.appendAssistTurn({
      userId: learner.userId,
      surface: 'assist-read',
      subjectType: 'article',
      subjectId: article.id,
      userContent: 'Why?',
      assistantContent: 'Because…',
      assistantStatus: 'complete',
      userMetadata: { actionId: 'meaning', selection: 'mysteries' },
    });

    const snapshot = await getReadingHistory(learner.cookie);
    expect(snapshot.portrait.lookedUpWords).toBe(2);
  });
});
