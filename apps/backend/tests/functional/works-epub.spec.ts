import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { contentAsset as contentAssetTable, readingWork as readingWorkTable, user as userTable } from '@gloaming/db';
import type { CreateEpubWorkResult } from '@gloaming/shared/api/works';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import { resetObjectStoreCache, setObjectStoreForTests } from '@/modules/oss';

import { createMemoryObjectStore } from '../helpers/memory-oss';

const password = 'password123';

const ZIP_BYTES = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fake epub content for tests')]);

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

async function uploadEpub(cookie: string, input: { fileName: string; bytes: Buffer; type: string }) {
  const form = new FormData();
  form.append('file', new File([new Blob([input.bytes])], input.fileName, { type: input.type }));
  return app.request('/api/admin/works/epub', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });
}

describe('POST /api/admin/works/epub', () => {
  const memory = createMemoryObjectStore();
  const createdWorkIds: string[] = [];
  let adminCookie = '';
  let userCookie = '';

  beforeAll(async () => {
    memory.store.clear();
    setObjectStoreForTests(memory);
    adminCookie = (await createSession('admin')).cookie;
    userCookie = (await createSession('user')).cookie;
  });

  afterAll(async () => {
    for (const workId of createdWorkIds) {
      await db.delete(readingWorkTable).where(eq(readingWorkTable.id, workId));
    }
    resetObjectStoreCache();
  });

  it('requires admin', async () => {
    const response = await uploadEpub(userCookie, {
      fileName: 'book.epub',
      bytes: ZIP_BYTES,
      type: 'application/epub+zip',
    });
    expect(response.status).toBe(403);
  });

  it('uploads an EPUB, creates a draft work and an origin_file asset', async () => {
    const response = await uploadEpub(adminCookie, {
      fileName: 'The Great Book.epub',
      bytes: ZIP_BYTES,
      type: 'application/epub+zip',
    });
    expect(response.status).toBe(201);

    const result = (await response.json()) as CreateEpubWorkResult;
    expect(result.title).toBe('The Great Book');
    expect(result.status).toBe('draft');
    expect(result.originKind).toBe('admin_epub');
    expect(result.asset.storageKey).toBe(`epub/${result.id}.epub`);
    expect(result.asset.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.asset.size).toBe(ZIP_BYTES.length);
    createdWorkIds.push(result.id);

    expect(memory.store.has(result.asset.storageKey)).toBe(true);

    const [workRow] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, result.id));
    expect(workRow).toBeDefined();
    expect(workRow?.originKind).toBe('admin_epub');
    expect(workRow?.originMeta).toMatchObject({ originalFileName: 'The Great Book.epub' });

    const assetRows = await db.select().from(contentAssetTable).where(eq(contentAssetTable.workId, result.id));
    expect(assetRows).toHaveLength(1);
    expect(assetRows[0]?.kind).toBe('origin_file');
    expect(assetRows[0]?.storageKey).toBe(result.asset.storageKey);
  });

  it('rejects non-EPUB files with a user-facing message', async () => {
    const response = await uploadEpub(adminCookie, {
      fileName: 'notes.txt',
      bytes: Buffer.from('plain text'),
      type: 'text/plain',
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain('epub');
  });

  it('rejects EPUB files that are not zip archives', async () => {
    const response = await uploadEpub(adminCookie, {
      fileName: 'fake.epub',
      bytes: Buffer.from('definitely not a zip'),
      type: 'application/epub+zip',
    });
    expect(response.status).toBe(400);
  });

  it('deleting the work removes the object from storage', async () => {
    const response = await uploadEpub(adminCookie, {
      fileName: 'Delete Me.epub',
      bytes: ZIP_BYTES,
      type: 'application/epub+zip',
    });
    expect(response.status).toBe(201);
    const result = (await response.json()) as CreateEpubWorkResult;
    createdWorkIds.push(result.id);
    expect(memory.store.has(result.asset.storageKey)).toBe(true);

    const deleteResponse = await app.request(`/api/admin/works/${result.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    });
    expect(deleteResponse.status).toBe(204);
    expect(memory.store.has(result.asset.storageKey)).toBe(false);
  });
});
