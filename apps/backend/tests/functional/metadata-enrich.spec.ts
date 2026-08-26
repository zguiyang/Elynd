import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  category as categoryTable,
  readingWork as readingWorkTable,
  readingWorkCategory as readingWorkCategoryTable,
  readingWorkTag as readingWorkTagTable,
  uploadedObject as uploadedObjectTable,
  user as userTable,
} from '@gloaming/db';
import { AUTH_ADMIN_ROLE } from '@gloaming/shared/auth/policy';

import app from '@/app';
import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { processMetadataEnrich } from '@/jobs/metadata-enrich';
import { AppError } from '@/lib/errors';
import { processContentWork } from '@/modules/content-parser';
import { enrichWorkMetadata } from '@/modules/metadata-enrich/service';
import { listCategoriesTool, listExistingTagsTool } from '@/modules/metadata-enrich/tools';
import { fillWorkMetadata } from '@/modules/metadata-fill/service';
import { resetObjectStoreCache, setObjectStoreForTests } from '@/modules/oss';

import { buildEpubBytes } from '../helpers/epub-builder';
import { createMemoryObjectStore } from '../helpers/memory-oss';

const { invokeAiMock } = vi.hoisted(() => ({ invokeAiMock: vi.fn() }));

vi.mock('@/modules/ai', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, invokeAi: invokeAiMock };
});

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

describe('metadata-enrich AI backfill (invokeAi mocked)', () => {
  const memory = createMemoryObjectStore();
  const createdWorkIds: string[] = [];
  let adminCookie = '';

  const chapter = {
    href: 'chapter-1.xhtml',
    tocLabel: 'Chapter 1',
    content:
      '<html xmlns="http://www.w3.org/1999/xhtml"><body>' +
      '<h1>Chapter 1</h1>' +
      '<p>' +
      'word '.repeat(120) +
      '</p>' +
      '</body></html>',
  };

  beforeAll(async () => {
    memory.store.clear();
    setObjectStoreForTests(memory);
    const email = uniqueEmail('admin');
    const username = `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ email, password, name: 'admin', username }),
    });
    await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));
    await db.update(userTable).set({ role: AUTH_ADMIN_ROLE }).where(eq(userTable.email, email));
    const login = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ email, password }),
    });
    adminCookie = cookieHeader(login);
  });

  afterAll(async () => {
    for (const workId of createdWorkIds) {
      await db.delete(readingWorkTable).where(eq(readingWorkTable.id, workId));
    }
    await db.delete(uploadedObjectTable);
    resetObjectStoreCache();
  });

  async function createParsedWork(input: {
    title: string;
    description?: string;
    subjects?: string[];
  }): Promise<string> {
    const bytes = await buildEpubBytes({ title: input.title, chapters: [chapter], ...input });
    const form = new FormData();
    form.append('file', new File([new Blob([bytes])], 'book.epub', { type: 'application/epub+zip' }));
    const response = await app.request('/api/admin/works/epub', {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: form,
    });
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    createdWorkIds.push(created.id);
    await processContentWork(created.id);
    await fillWorkMetadata(created.id);
    return created.id;
  }

  beforeEach(() => {
    invokeAiMock.mockReset();
    invokeAiMock.mockResolvedValue({
      content: {},
      model: { rowId: 'row', label: 'mock', modelId: 'mock-model' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
  });

  it('short-circuits with completed when nothing needs AI (zero cost)', async () => {
    const workId = await createParsedWork({
      title: 'Complete Book',
      description:
        'A fully written description with plenty of detail to be useful for readers browsing the catalog shelf.',
      subjects: ['Science'],
    });
    const [cat] = await db
      .select({ id: categoryTable.id })
      .from(categoryTable)
      .where(eq(categoryTable.name, 'Science'));
    await db.insert(readingWorkCategoryTable).values({ workId, categoryId: cat!.id, provenance: 'extracted' });

    await enrichWorkMetadata(workId);

    expect(invokeAiMock).not.toHaveBeenCalled();
    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(work!.metadataEnrichmentStatus).toBe('completed');
  });

  it('fills empty/weak fields with ai provenance and merges the jsonb view', async () => {
    const workId = await createParsedWork({ title: 'Fill Book' });

    invokeAiMock.mockResolvedValueOnce({
      content: {
        description: 'An AI written summary of the book.',
        tags: ['Space', 'Adventure'],
        category: 'Science Fiction',
      },
      model: { rowId: 'row', label: 'mock', modelId: 'mock-model' },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    await enrichWorkMetadata(workId);

    expect(invokeAiMock).toHaveBeenCalledTimes(1);
    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(work!.metadataEnrichmentStatus).toBe('completed');
    expect(work!.description).toBe('An AI written summary of the book.');
    expect(work!.metadataProvenance).toMatchObject({ description: 'ai', tags: 'ai', category: 'ai' });

    const tagRows = await db
      .select({ provenance: readingWorkTagTable.provenance })
      .from(readingWorkTagTable)
      .where(eq(readingWorkTagTable.workId, workId));
    expect(tagRows.map((r) => r.provenance)).toEqual(['ai', 'ai']);
    expect(work!.tags).toEqual(['Space', 'Adventure']);

    const categoryRows = await db
      .select({ provenance: readingWorkCategoryTable.provenance })
      .from(readingWorkCategoryTable)
      .where(eq(readingWorkCategoryTable.workId, workId));
    expect(categoryRows).toHaveLength(1);
    expect(categoryRows[0]!.provenance).toBe('ai');
  });

  it('does not override manual values and skips non-pending works', async () => {
    const workId = await createParsedWork({ title: 'Manual Fill Book', subjects: ['Science'] });

    await app.request(`/api/admin/works/${workId}`, {
      method: 'PATCH',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: ['Manual Tag'],
        description: 'A solid hand-written description that is long enough.',
      }),
    });

    await enrichWorkMetadata(workId);

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(work!.description).toBe('A solid hand-written description that is long enough.');
    expect(work!.metadataProvenance.description).toBe('manual');
    expect(work!.tags).toContain('Manual Tag');

    // Second run on a completed work must not invoke the model again.
    const callsAfterFirst = invokeAiMock.mock.calls.length;
    await enrichWorkMetadata(workId);
    expect(invokeAiMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('degrades to skipped when the model is not configured (503)', async () => {
    const workId = await createParsedWork({ title: 'No Model Book' });

    invokeAiMock.mockRejectedValueOnce(
      new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Metadata enrich model not configured'),
    );

    await enrichWorkMetadata(workId);

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(work!.metadataEnrichmentStatus).toBe('skipped');
  });

  it('restores pending on failure so the bounded retry can re-claim (at-least-once)', async () => {
    const workId = await createParsedWork({ title: 'Retry Book' });

    invokeAiMock.mockRejectedValueOnce(new Error('upstream boom'));

    await expect(processMetadataEnrich({ workId })).rejects.toThrow('upstream boom');

    const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(work!.metadataEnrichmentStatus).toBe('pending');

    invokeAiMock.mockResolvedValueOnce({
      content: { description: 'Recovered on retry.' },
      model: { rowId: 'row', label: 'mock', modelId: 'mock-model' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    await processMetadataEnrich({ workId });

    const [after] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId));
    expect(after!.metadataEnrichmentStatus).toBe('completed');
    expect(after!.description).toBe('Recovered on retry.');
  });

  it('list_existing_tags returns top-N by usage and searches by normalized name', async () => {
    await createParsedWork({ title: 'Tool Book', subjects: ['Science', 'Adventure'] });

    const top = await listExistingTagsTool().invoke({});
    const parsedTop = JSON.parse(top) as { tags: Array<{ name: string; usage: number }> };
    expect(parsedTop.tags.length).toBeGreaterThanOrEqual(2);
    expect(parsedTop.tags.some((t) => t.name === 'Science')).toBe(true);

    const searched = await listExistingTagsTool().invoke({ query: 'adventure' });
    const parsedSearch = JSON.parse(searched) as { tags: Array<{ name: string; usage: number }> };
    expect(parsedSearch.tags.map((t) => t.name)).toContain('Adventure');
  });

  it('list_categories returns the seeded enumeration', async () => {
    const raw = await listCategoriesTool().invoke({});
    const parsed = JSON.parse(raw) as { categories: string[] };
    expect(parsed.categories).toContain('Science Fiction');
    expect(parsed.categories).toContain('Classic');
  });
});
