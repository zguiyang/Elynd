import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';

import {
  category as categoryTable,
  type MetadataEnrichmentStatus,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
  readingWorkCategory as readingWorkCategoryTable,
  readingWorkTag as readingWorkTagTable,
  tag as tagTable,
  type WorkMetadataProvenanceMap,
} from '@gloaming/db';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { normalizeTag } from '@/lib/text';
import { type AiInvokeResult, invokeAi } from '@/modules/ai';
import type { MetadataFieldId } from '@/modules/metadata-enrich/fields';
import { buildEnrichMessages, EXCERPT_MAX_CHARS, TOC_TITLE_MAX } from '@/modules/metadata-enrich/prompt';
import { aiFillableFields, buildMetadataOutputSchema, metadataFieldRegistry } from '@/modules/metadata-enrich/registry';
import { listCategoriesTool, listExistingTagsTool } from '@/modules/metadata-enrich/tools';

const enrichLogger = rootLogger.child({ module: 'MetadataEnrich' });

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCountOf(text: string): number {
  return stripHtml(text).split(/\s+/).filter(Boolean).length;
}

async function loadBookContext(workId: string): Promise<{ excerpt: string; tocTitles: string[] }> {
  const parts = await db
    .select({ title: readingPartTable.title, body: readingPartTable.body })
    .from(readingPartTable)
    .where(eq(readingPartTable.workId, workId))
    .orderBy(asc(readingPartTable.sortOrder), asc(readingPartTable.id));
  const tocTitles = parts
    .map((p) => p.title.trim())
    .filter(Boolean)
    .slice(0, TOC_TITLE_MAX);
  const target = parts.find((p) => wordCountOf(p.body) >= 100) ?? parts[0];
  const excerpt = target ? stripHtml(target.body).slice(0, EXCERPT_MAX_CHARS) : '';
  return { excerpt, tocTitles };
}

async function loadCurrentTags(workId: string): Promise<string[]> {
  const rows = await db
    .select({ name: tagTable.name })
    .from(readingWorkTagTable)
    .innerJoin(tagTable, eq(readingWorkTagTable.tagId, tagTable.id))
    .where(eq(readingWorkTagTable.workId, workId));
  return rows.map((row) => row.name);
}

async function loadCurrentCategory(workId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ name: categoryTable.name })
    .from(readingWorkCategoryTable)
    .innerJoin(categoryTable, eq(readingWorkCategoryTable.categoryId, categoryTable.id))
    .where(eq(readingWorkCategoryTable.workId, workId))
    .limit(1);
  return row?.name;
}

function isModelNotConfigured(error: unknown): boolean {
  return error instanceof AppError && error.statusCode === HTTP_STATUS.SERVICE_UNAVAILABLE;
}

/**
 * AI backfill orchestration — fills empty/weak fields only (never overrides
 * manual values). Short-circuits with zero cost when nothing is needed.
 * Model-not-configured degrades to `skipped`; other failures bubble up so the
 * job can restore `pending` for a bounded retry (at-least-once).
 */
export async function enrichWorkMetadata(workId: string): Promise<void> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    throw new Error(`Work ${workId} not found`);
  }
  if (work.originKind !== 'admin_epub') {
    return;
  }
  if (work.metadataEnrichmentStatus !== 'pending') {
    return;
  }

  const [currentTags, currentCategory, context] = await Promise.all([
    loadCurrentTags(workId),
    loadCurrentCategory(workId),
    loadBookContext(workId),
  ]);

  const needed = new Set<(typeof aiFillableFields)[number]>();
  for (const id of aiFillableFields) {
    const def = metadataFieldRegistry[id];
    const current =
      id === 'description' ? work.description : id === 'tags' ? currentTags.join(', ') : (currentCategory ?? '');
    if (def.isWeak(current)) {
      needed.add(id);
    }
  }

  if (needed.size === 0) {
    await db
      .update(readingWorkTable)
      .set({ metadataEnrichmentStatus: 'completed', metadataEnrichmentAt: new Date() })
      .where(eq(readingWorkTable.id, workId));
    return;
  }

  const claimed = await db
    .update(readingWorkTable)
    .set({ metadataEnrichmentStatus: 'running' })
    .where(and(eq(readingWorkTable.id, workId), eq(readingWorkTable.metadataEnrichmentStatus, 'pending')))
    .returning({ id: readingWorkTable.id });
  if (claimed.length === 0) {
    return;
  }

  const outputSchema = buildMetadataOutputSchema([...needed]);
  let result: AiInvokeResult<z.infer<typeof outputSchema>>;
  try {
    result = await invokeAi({
      purpose: 'metadata-enrich',
      source: 'metadata-enrich.fill',
      ref: { type: 'reading_work', id: workId },
      messages: buildEnrichMessages({
        title: work.title,
        author: work.author,
        language: work.language,
        existingTags: currentTags,
        ruleDescription: work.description,
        excerpt: context.excerpt,
        tocTitles: context.tocTitles,
        requiredFields: [...needed],
      }),
      tools: [listExistingTagsTool(), listCategoriesTool()],
      outputSchema,
      requestSummaryExtra: { workId, neededFields: [...needed].join(',') },
    });
  } catch (error) {
    if (isModelNotConfigured(error)) {
      await db
        .update(readingWorkTable)
        .set({ metadataEnrichmentStatus: 'skipped' })
        .where(eq(readingWorkTable.id, workId));
      return;
    }
    throw error;
  }

  const provenance: WorkMetadataProvenanceMap = { ...work.metadataProvenance };
  const status: MetadataEnrichmentStatus = 'completed';

  await db.transaction(async (tx) => {
    const patch: Partial<typeof readingWorkTable.$inferInsert> = {};

    const aiDescription = metadataFieldRegistry.description.normalize(result.content.description);
    if (needed.has('description') && typeof aiDescription === 'string') {
      patch.description = aiDescription;
      provenance.description = 'ai';
    }

    // Tags — the model declares reuse (kind:"existing" + id from tools) or
    // creation. Intent is advisory: ids are validated, and names always fall
    // back to normalized reuse-first upserts (never duplicate dimensions).
    const aiTags = metadataFieldRegistry.tags.normalize(result.content.tags) as
      Array<{ name: string; existingId?: string }> | undefined;
    if (needed.has('tags') && Array.isArray(aiTags)) {
      const tagIds: string[] = [];
      for (const tag of aiTags) {
        const id = await resolveTagId(tx, tag);
        if (id) tagIds.push(id);
      }
      if (tagIds.length > 0) {
        await tx
          .delete(readingWorkTagTable)
          .where(and(eq(readingWorkTagTable.workId, workId), eq(readingWorkTagTable.provenance, 'ai')));
        for (const tagId of tagIds) {
          await tx.insert(readingWorkTagTable).values({ workId, tagId, provenance: 'ai' }).onConflictDoNothing();
        }
        const rows = await tx
          .select({ name: tagTable.name })
          .from(readingWorkTagTable)
          .innerJoin(tagTable, eq(readingWorkTagTable.tagId, tagTable.id))
          .where(eq(readingWorkTagTable.workId, workId));
        patch.tags = rows.map((row) => row.name);
        provenance.tags = 'ai';
      }
    }

    // Category — single-select; null means "no category". Same adjudication.
    const aiCategory = metadataFieldRegistry.category.normalize(result.content.category) as
      { name: string; existingId?: string } | undefined;
    if (needed.has('category') && aiCategory) {
      const categoryId = await resolveCategoryId(tx, aiCategory);
      if (categoryId) {
        await tx
          .delete(readingWorkCategoryTable)
          .where(and(eq(readingWorkCategoryTable.workId, workId), eq(readingWorkCategoryTable.provenance, 'ai')));
        await tx
          .insert(readingWorkCategoryTable)
          .values({ workId, categoryId, provenance: 'ai' })
          .onConflictDoNothing();
        provenance.category = 'ai';
      }
    }

    patch.metadataEnrichmentStatus = status;
    patch.metadataEnrichmentAt = new Date();
    patch.metadataProvenance = provenance;
    await tx.update(readingWorkTable).set(patch).where(eq(readingWorkTable.id, workId));
  });

  // Observation point: required fields that the model skipped entirely.
  const missing: MetadataFieldId[] = [];
  if (needed.has('description') && !result.content.description) missing.push('description');
  if (needed.has('tags') && !Array.isArray(result.content.tags)) missing.push('tags');
  if (needed.has('category') && result.content.category === undefined) missing.push('category');
  if (missing.length > 0) {
    enrichLogger.warn({ workId, missingFields: missing }, 'Metadata enrich completed with fields left unfilled');
  }
}

/** Resolve a tag ref to a concrete dimension id — reuse validated, then normalized, then create. */
async function resolveTagId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tag: { name: string; existingId?: string },
): Promise<string | null> {
  if (tag.existingId) {
    const [row] = await tx.select({ id: tagTable.id }).from(tagTable).where(eq(tagTable.id, tag.existingId)).limit(1);
    if (row) return row.id;
  }
  return upsertTagId(tx, tag.name);
}

/** Category ref — same adjudication, single row. */
async function resolveCategoryId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  category: { name: string; existingId?: string },
): Promise<string | null> {
  if (category.existingId) {
    const [row] = await tx
      .select({ id: categoryTable.id })
      .from(categoryTable)
      .where(eq(categoryTable.id, category.existingId))
      .limit(1);
    if (row) return row.id;
  }
  return upsertCategoryId(tx, category.name);
}

async function upsertTagId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  name: string,
): Promise<string | null> {
  const [row] = await tx
    .insert(tagTable)
    .values({ id: randomUUID(), name, normalized: normalizeTag(name), origin: 'ai' })
    .onConflictDoUpdate({ target: tagTable.normalized, set: { name } })
    .returning();
  return row?.id ?? null;
}

async function upsertCategoryId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  name: string,
): Promise<string | null> {
  const [row] = await tx
    .insert(categoryTable)
    .values({ id: randomUUID(), name, normalized: normalizeTag(name), origin: 'ai' })
    .onConflictDoUpdate({ target: categoryTable.normalized, set: { name } })
    .returning();
  return row?.id ?? null;
}
