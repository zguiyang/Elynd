import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  contentAsset as contentAssetTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
  uploadedObject as uploadedObjectTable,
  user as userTable,
} from '@gloaming/db';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import { processContentWork } from '@/modules/content-parser';
import { fillWorkMetadata } from '@/modules/metadata-fill/service';
import { resetObjectStoreCache, setObjectStoreForTests } from '@/modules/oss';

import { buildEpubBytes, buildSampleEpubBytes } from '../helpers/epub-builder';
import { createMemoryObjectStore } from '../helpers/memory-oss';

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
  const email = uniqueEmail('admin');
  const username = `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  expect((await signUp({ email, username, name: 'admin' })).status).toBe(200);
  await markEmailVerified(email);
  await setUserRole(email, AUTH_ADMIN_ROLE);
  const login = await signInEmail(email);
  expect(login.status).toBe(200);
  return cookieHeader(login);
}

async function uploadEpub(cookie: string, bytes: Buffer) {
  const form = new FormData();
  form.append('file', new File([new Blob([bytes])], 'book.epub', { type: 'application/epub+zip' }));
  return app.request('/api/admin/works/epub', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });
}

describe('EPUB ingest pipeline', () => {
  const memory = createMemoryObjectStore();
  const createdWorkIds: string[] = [];
  let adminCookie = '';

  beforeAll(async () => {
    memory.store.clear();
    setObjectStoreForTests(memory);
    adminCookie = await createAdminSession();
  });

  afterAll(async () => {
    for (const workId of createdWorkIds) {
      await db.delete(readingWorkTable).where(eq(readingWorkTable.id, workId));
    }
    await db.delete(uploadedObjectTable);
    resetObjectStoreCache();
  });

  it('parses a sample EPUB into chapters, metadata, cover and images', async () => {
    const bytes = await buildSampleEpubBytes();
    const response = await uploadEpub(adminCookie, bytes);
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);

    // Upload enqueues the job; run the ingest + metadata-fill synchronously.
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(work).toBeDefined();
    expect(work!.status).toBe('draft');
    expect(work!.title).toBe('The Great Book');
    expect(work!.author).toBe('Jane Author');
    expect(work!.description).toBe('A sample story.');
    expect(work!.language).toBe('en');

    const parts = await db
      .select()
      .from(readingPartTable)
      .where(eq(readingPartTable.workId, created.id))
      .orderBy(readingPartTable.sortOrder);
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.title)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
    expect(parts.map((p) => p.kind)).toEqual(['chapter', 'chapter', 'chapter']);
    expect(parts[0]!.body).toContain('Call me Ishmael.');
    expect(parts[0]!.body).toContain('data-p=');

    const assets = await db.select().from(contentAssetTable).where(eq(contentAssetTable.workId, created.id));
    const cover = assets.find((a) => a.kind === 'cover');
    expect(cover).toBeDefined();
    expect(work!.coverAssetId).toBe(cover!.id);

    const parsed = work!.originMeta.parsed as { chapterCount: number; imageCount: number; authors: string[] };
    expect(parsed.chapterCount).toBe(3);
    expect(parsed.authors).toEqual(['Jane Author']);
  });

  it('handles a single-file EPUB split by headings and drops front matter', async () => {
    const bytes = await buildEpubBytes({
      title: 'Single Book',
      chapters: [
        {
          href: 'all.xhtml',
          content: `<html xmlns="http://www.w3.org/1999/xhtml"><body>
            <h2>Contents</h2><p>list</p>
            <h2>Chapter 1</h2><p>First.</p>
            <h2>Chapter 2</h2><p>Second.</p>
            <h2>Chapter 3</h2><p>Third.</p>
          </body></html>`,
        },
      ],
    });
    const response = await uploadEpub(adminCookie, bytes);
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);

    await processContentWork(created.id);

    const parts = await db
      .select()
      .from(readingPartTable)
      .where(eq(readingPartTable.workId, created.id))
      .orderBy(readingPartTable.sortOrder);
    expect(parts.map((p) => p.title)).toEqual(['Part Chapter 1', 'Part Chapter 2', 'Part Chapter 3']);
    expect(parts.map((p) => (p.body.join ? '' : p.body)).join('')).toContain('First.');
  });

  it('marks the work failed when parsing fails', async () => {
    const zip = new (await import('jszip')).default();
    zip.file('random.txt', 'not an epub');
    const badBytes = await zip.generateAsync({ type: 'nodebuffer' });
    const response = await uploadEpub(adminCookie, badBytes);
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);

    await expect(processContentWork(created.id)).rejects.toThrow();

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(work!.status).toBe('failed');
    expect(String(work!.originMeta.lastError ?? '')).toContain('container.xml');
  });
});

describe('POST /api/admin/works/:id/reparse', () => {
  const memory = createMemoryObjectStore();
  const createdWorkIds: string[] = [];
  let adminCookie = '';

  beforeAll(async () => {
    memory.store.clear();
    setObjectStoreForTests(memory);
    adminCookie = await createAdminSession();
  });

  afterAll(async () => {
    for (const workId of createdWorkIds) {
      await db.delete(readingWorkTable).where(eq(readingWorkTable.id, workId));
    }
    await db.delete(uploadedObjectTable);
    resetObjectStoreCache();
  });

  async function reparseRequest(id: string) {
    return app.request(`/api/admin/works/${id}/reparse`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
  }

  async function patchRequest(id: string, body: Record<string, unknown>) {
    return app.request(`/api/admin/works/${id}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('recovers a failed work: clears lastError, sets processing, re-parses to draft', async () => {
    const response = await uploadEpub(adminCookie, await buildSampleEpubBytes());
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);

    await db
      .update(readingWorkTable)
      .set({ status: 'failed', originMeta: { lastError: 'simulated failure', failedAt: '2026-08-25T00:00:00.000Z' } })
      .where(eq(readingWorkTable.id, created.id));

    const reparse = await reparseRequest(created.id);
    expect(reparse.status).toBe(200);
    expect(((await reparse.json()) as { status: string }).status).toBe('processing');

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(work!.status).toBe('processing');
    expect(work!.originMeta.lastError).toBeUndefined();

    await processContentWork(created.id);
    await fillWorkMetadata(created.id);
    const [after] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(after!.status).toBe('draft');
    expect(after!.title).toBe('The Great Book');
  });

  it('refuses to re-parse published works', async () => {
    const response = await uploadEpub(adminCookie, await buildSampleEpubBytes());
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);

    await patchRequest(created.id, { sourceNote: 'test-source', tags: ['story'] });
    const publish = await app.request(`/api/admin/works/${created.id}/publish`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    expect(publish.status).toBe(200);

    const reparse = await reparseRequest(created.id);
    expect(reparse.status).toBe(409);
  });

  it('refuses to re-parse while processing', async () => {
    const response = await uploadEpub(adminCookie, await buildSampleEpubBytes());
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);

    const reparse = await reparseRequest(created.id);
    expect(reparse.status).toBe(409);
  });

  it('keeps hand-edited metadata across re-parse (first parse fills, re-run preserves)', async () => {
    const response = await uploadEpub(adminCookie, await buildSampleEpubBytes());
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);

    await patchRequest(created.id, {
      title: 'Edited Title',
      author: 'Edited Author',
      description: 'Edited description',
    });

    const reparse = await reparseRequest(created.id);
    expect(reparse.status).toBe(200);
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(work!.title).toBe('Edited Title');
    expect(work!.author).toBe('Edited Author');
    expect(work!.description).toBe('Edited description');
    expect(work!.status).toBe('draft');
  });

  it('resets the AI backfill claim on re-parse so enrichment can re-run', async () => {
    const response = await uploadEpub(adminCookie, await buildSampleEpubBytes());
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);

    await db
      .update(readingWorkTable)
      .set({ metadataEnrichmentStatus: 'completed', metadataEnrichmentAt: new Date() })
      .where(eq(readingWorkTable.id, created.id));

    const reparse = await reparseRequest(created.id);
    expect(reparse.status).toBe(200);

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, created.id));
    expect(work!.metadataEnrichmentStatus).toBe('pending');
    expect(work!.metadataEnrichmentAt).toBeNull();
  });
});
