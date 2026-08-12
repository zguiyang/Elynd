import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { article as articleTable, user as userTable } from '@elynd/db';
import {
  type AdminArticleListData,
  type Article,
  ARTICLE_BODY_MAX_WORDS,
  type LibraryArticleListData,
} from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, DEFAULT_SORT_ORDER } from '@elynd/shared/api/pagination';
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

describe('Articles HTTP', () => {
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

  it('guards admin article writes and learner reads by session/role', async () => {
    const anonymousCreate = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    });
    expect(anonymousCreate.status).toBe(401);

    const user = await createSession('user');
    createdEmails.push(user.email);
    const userDenied = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: user.cookie },
      body: JSON.stringify({ title: 'Nope' }),
    });
    expect(userDenied.status).toBe(403);

    const learnerAnon = await app.request('/api/articles');
    expect(learnerAnon.status).toBe(401);
  });

  it('creates, updates, publishes, lists for admin and learner, then unpublishes', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({ title: 'Rain Walk' }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as Article;
    createdArticleIds.push(created.id);
    expect(created.status).toBe('draft');
    expect(created.publishedAt).toBeNull();

    const incompletePublish = await app.request(`/api/admin/articles/${created.id}/publish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(incompletePublish.status).toBe(400);
    const incompleteBody = (await incompletePublish.json()) as { error: string; details: unknown[] };
    expect(incompleteBody.error).toBe('Validation failed');
    expect(incompleteBody.details.length).toBeGreaterThan(0);

    const patch = await app.request(`/api/admin/articles/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        body: 'She kept walking through the quiet rain toward the bus stop.',
        themes: ['故事'],
        sourceNote: '原创短叙事',
        level: 'easy',
        estimatedMinutes: 5,
      }),
    });
    expect(patch.status).toBe(200);

    const publish = await app.request(`/api/admin/articles/${created.id}/publish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(publish.status).toBe(200);
    const published = (await publish.json()) as Article;
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeTruthy();

    const adminList = await app.request('/api/admin/articles?status=published', {
      headers: { cookie: admin.cookie },
    });
    expect(adminList.status).toBe(200);
    const adminListBody = (await adminList.json()) as AdminArticleListData;
    expect(adminListBody.items.some((item) => item.id === created.id)).toBe(true);
    expect(adminListBody.pagination).toMatchObject({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'updatedAt',
      sortOrder: DEFAULT_SORT_ORDER,
    });
    expect(adminListBody.pagination.total).toBeGreaterThanOrEqual(1);

    const learnerList = await app.request('/api/articles', {
      headers: { cookie: learner.cookie },
    });
    expect(learnerList.status).toBe(200);
    const learnerListBody = (await learnerList.json()) as LibraryArticleListData;
    expect(learnerListBody.items.some((item) => item.id === created.id)).toBe(true);
    expect(learnerListBody.pagination).toMatchObject({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: 'publishedAt',
      sortOrder: DEFAULT_SORT_ORDER,
    });
    expect(learnerListBody.themes).toContain('故事');

    const learnerDetail = await app.request(`/api/articles/${created.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(learnerDetail.status).toBe(200);

    const unpublish = await app.request(`/api/admin/articles/${created.id}/unpublish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(unpublish.status).toBe(200);
    const unpublished = (await unpublish.json()) as Article;
    expect(unpublished.status).toBe('draft');
    expect(unpublished.publishedAt).toBeNull();

    const learnerHidden = await app.request(`/api/articles/${created.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(learnerHidden.status).toBe(404);

    const draftOnly = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Hidden Draft',
        body: 'A short draft body for visibility checks.',
        themes: ['故事'],
        sourceNote: '草稿',
      }),
    });
    expect(draftOnly.status).toBe(201);
    const draft = (await draftOnly.json()) as Article;
    createdArticleIds.push(draft.id);

    const learnerDraft = await app.request(`/api/articles/${draft.id}`, {
      headers: { cookie: learner.cookie },
    });
    expect(learnerDraft.status).toBe(404);
  });

  it('filters, paginates, and sorts learner library list', async () => {
    const admin = await createSession('admin');
    const learner = await createSession('user');
    createdEmails.push(admin.email, learner.email);

    async function createPublished(input: { title: string; themes: string[]; body: string }) {
      const create = await app.request('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          themes: input.themes,
          sourceNote: '测试',
          level: 'easy',
        }),
      });
      expect(create.status).toBe(201);
      const created = (await create.json()) as Article;
      createdArticleIds.push(created.id);

      const publish = await app.request(`/api/admin/articles/${created.id}/publish`, {
        method: 'POST',
        headers: { cookie: admin.cookie },
      });
      expect(publish.status).toBe(200);
      return created.id;
    }

    const scienceId = await createPublished({
      title: 'Ocean Science Notes',
      themes: ['science'],
      body: 'A short note about tides and salt air.',
    });
    const storyId = await createPublished({
      title: 'City Story Lights',
      themes: ['story'],
      body: 'She watched the neon flicker across wet streets.',
    });
    await createPublished({
      title: 'Quiet Garden',
      themes: ['nature'],
      body: 'Soft rain tapped the greenhouse roof all morning.',
    });

    const byTheme = await app.request('/api/articles?theme=science&pageSize=10', {
      headers: { cookie: learner.cookie },
    });
    expect(byTheme.status).toBe(200);
    const themeBody = (await byTheme.json()) as LibraryArticleListData;
    expect(themeBody.items.map((item) => item.id)).toEqual([scienceId]);
    expect(themeBody.themes).toEqual(expect.arrayContaining(['science', 'story', 'nature']));

    const byQuery = await app.request('/api/articles?q=city&page=1&pageSize=10', {
      headers: { cookie: learner.cookie },
    });
    expect(byQuery.status).toBe(200);
    const queryBody = (await byQuery.json()) as LibraryArticleListData;
    expect(queryBody.items.map((item) => item.id)).toEqual([storyId]);

    const pageOne = await app.request('/api/articles?page=1&pageSize=2&sortBy=createdAt&sortOrder=asc', {
      headers: { cookie: learner.cookie },
    });
    expect(pageOne.status).toBe(200);
    const pageOneBody = (await pageOne.json()) as LibraryArticleListData;
    expect(pageOneBody.items).toHaveLength(2);
    expect(pageOneBody.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
    expect(pageOneBody.pagination.total).toBeGreaterThanOrEqual(3);
    expect(pageOneBody.pagination.totalPages).toBeGreaterThanOrEqual(2);

    const badPage = await app.request('/api/articles?page=0', {
      headers: { cookie: learner.cookie },
    });
    expect(badPage.status).toBe(400);
  });

  it('paginates and filters admin article list', async () => {
    const admin = await createSession('admin');
    createdEmails.push(admin.email);

    async function createDraft(title: string) {
      const create = await app.request('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({ title }),
      });
      expect(create.status).toBe(201);
      const created = (await create.json()) as Article;
      createdArticleIds.push(created.id);
      return created.id;
    }

    await createDraft('Admin Page Alpha');
    await createDraft('Admin Page Beta');
    await createDraft('Admin Page Gamma');

    const pageOne = await app.request('/api/admin/articles?page=1&pageSize=2&status=draft', {
      headers: { cookie: admin.cookie },
    });
    expect(pageOne.status).toBe(200);
    const pageOneBody = (await pageOne.json()) as AdminArticleListData;
    expect(pageOneBody.items).toHaveLength(2);
    expect(pageOneBody.items.every((item) => item.status === 'draft')).toBe(true);
    expect(pageOneBody.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      sortBy: 'updatedAt',
      sortOrder: DEFAULT_SORT_ORDER,
    });
    expect(pageOneBody.pagination.total).toBeGreaterThanOrEqual(3);
    expect(pageOneBody.pagination.totalPages).toBeGreaterThanOrEqual(2);

    const pageTwo = await app.request('/api/admin/articles?page=2&pageSize=2&status=draft', {
      headers: { cookie: admin.cookie },
    });
    expect(pageTwo.status).toBe(200);
    const pageTwoBody = (await pageTwo.json()) as AdminArticleListData;
    expect(pageTwoBody.items.length).toBeGreaterThanOrEqual(1);
    expect(pageTwoBody.pagination.page).toBe(2);

    const publishedOnly = await app.request('/api/admin/articles?status=published&pageSize=50', {
      headers: { cookie: admin.cookie },
    });
    expect(publishedOnly.status).toBe(200);
    const publishedBody = (await publishedOnly.json()) as AdminArticleListData;
    expect(publishedBody.items.every((item) => item.status === 'published')).toBe(true);
  });

  it('rejects publish when body exceeds word cap', async () => {
    const admin = await createSession('admin');
    createdEmails.push(admin.email);

    const longBody = Array.from({ length: ARTICLE_BODY_MAX_WORDS + 1 }, (_, i) => `w${i}`).join(' ');
    const create = await app.request('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        title: 'Too Long',
        body: longBody,
        themes: ['故事'],
        sourceNote: '测试',
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as Article;
    createdArticleIds.push(created.id);

    const publish = await app.request(`/api/admin/articles/${created.id}/publish`, {
      method: 'POST',
      headers: { cookie: admin.cookie },
    });
    expect(publish.status).toBe(400);
    const body = (await publish.json()) as { details: { path: string; message: string }[] };
    expect(body.details.some((d) => d.path === 'body')).toBe(true);
  });
});
