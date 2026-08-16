import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { article as articleTable, user as userTable } from '@elynd/db';
import type { Article } from '@elynd/shared/api/articles';
import type { GeneratePracticeItemsResponse } from '@elynd/shared/api/learn';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

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

async function createAdminSession() {
  const email = uniqueEmail('practice-gen');
  const username = `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  expect((await signUp({ email, username, name: 'practice' })).status).toBe(200);
  await markEmailVerified(email);
  await setUserRole(email, AUTH_ADMIN_ROLE);
  const login = await signInEmail(email);
  expect(login.status).toBe(200);
  return { email, cookie: cookieHeader(login) };
}

describe('Admin practice generate HTTP', () => {
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

  it('returns AI draft items without writing practice_item rows', async () => {
    const admin = await createAdminSession();
    createdEmails.push(admin.email);

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

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            kind: 'comprehension',
            prompt: '船停在哪里？',
            options: ['港口', '天空', '森林'],
            correctOptionIndex: 0,
          },
          {
            kind: 'vocab',
            word: 'harbor',
            hint: '在这句话里，它更接近哪个意思？',
            quote: 'Boats rest in the harbor.',
            options: ['港口 / 停泊处', '山脉', '沙漠'],
            correctOptionIndex: 0,
          },
        ],
      }),
      model: { rowId: 'mock-model', label: 'mock', modelId: 'mock' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

    try {
      const generate = await app.request(`/api/admin/articles/${article.id}/practice-items/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
        body: JSON.stringify({}),
      });
      expect(generate.status).toBe(200);
      const draft = (await generate.json()) as GeneratePracticeItemsResponse;
      expect(draft.items).toHaveLength(2);
      expect(draft.items[0]?.sortOrder).toBe(1);
      expect(draft.items[0]?.kind).toBe('comprehension');
      const comprehension = draft.items[0]!;
      expect(comprehension.payload.options).toEqual(expect.arrayContaining(['港口', '天空', '森林']));
      expect(comprehension.payload.options).toHaveLength(3);
      expect(comprehension.payload.options[comprehension.correctOptionIndex]).toBe('港口');
      const vocab = draft.items[1]!;
      expect(vocab.kind).toBe('vocab');
      expect(vocab.payload.options[vocab.correctOptionIndex]).toBe('港口 / 停泊处');
      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'practice',
          source: 'practice.generate',
        }),
      );
      expect(invokeSpy.mock.calls[0]?.[0]).not.toHaveProperty('outputSchema');

      const listed = await app.request(`/api/admin/articles/${article.id}/practice-items`, {
        headers: { cookie: admin.cookie },
      });
      expect(listed.status).toBe(200);
      expect(((await listed.json()) as { items: unknown[] }).items).toHaveLength(0);
    } finally {
      invokeSpy.mockRestore();
    }
  });
});
