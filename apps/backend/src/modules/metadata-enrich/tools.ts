import { desc, eq, ilike, sql } from 'drizzle-orm';
import { tool } from 'langchain/tools';
import { z } from 'zod';

import { category as categoryTable, readingWorkTag as readingWorkTagTable, tag as tagTable } from '@gloaming/db';

import { db } from '@/db';
import { normalizeTag } from '@/lib/text';

const MAX_TOOL_RESULTS = 20;

/**
 * Global tag catalog on demand — the full tag table never enters the prompt.
 * No query → top-N by association count; with query → fuzzy (normalized) match.
 * Returns ids so the model can declare `kind:"existing"` reuse decisions.
 */
export function listExistingTagsTool() {
  return tool(
    async ({ query, limit = 10 }: { query?: string; limit?: number }) => {
      const take = Math.min(Math.max(limit, 1), MAX_TOOL_RESULTS);
      if (query) {
        const needle = normalizeTag(query);
        const rows = await db
          .select({
            id: tagTable.id,
            name: tagTable.name,
            usage: sql<number>`count(${readingWorkTagTable.tagId})`,
          })
          .from(tagTable)
          .leftJoin(readingWorkTagTable, eq(readingWorkTagTable.tagId, tagTable.id))
          .where(ilike(tagTable.normalized, `%${needle}%`))
          .groupBy(tagTable.id)
          .orderBy(desc(sql`count(${readingWorkTagTable.tagId})`))
          .limit(take);
        return JSON.stringify({ tags: rows.map((r) => ({ id: r.id, name: r.name, usage: Number(r.usage) })) });
      }
      const rows = await db
        .select({
          id: tagTable.id,
          name: tagTable.name,
          usage: sql<number>`count(${readingWorkTagTable.tagId})`,
        })
        .from(tagTable)
        .leftJoin(readingWorkTagTable, eq(readingWorkTagTable.tagId, tagTable.id))
        .groupBy(tagTable.id)
        .orderBy(desc(sql`count(${readingWorkTagTable.tagId})`), tagTable.name)
        .limit(take);
      return JSON.stringify({ tags: rows.map((r) => ({ id: r.id, name: r.name, usage: Number(r.usage) })) });
    },
    {
      name: 'list_existing_tags',
      description:
        'List existing tags. Use without query to see the most used tags, or with query to search tags that already exist. Prefer reusing these tags — return kind:"existing" with the returned id.',
      schema: z.object({
        query: z.string().optional().describe('Optional search term for existing tags'),
        limit: z.number().int().min(1).max(MAX_TOOL_RESULTS).optional().describe('Max results'),
      }),
    },
  );
}

/** Admin-controlled category enumeration — always complete, always fresh, ids included. */
export function listCategoriesTool() {
  return tool(
    async () => {
      const rows = await db
        .select({ id: categoryTable.id, name: categoryTable.name })
        .from(categoryTable)
        .orderBy(categoryTable.name);
      return JSON.stringify({ categories: rows.map((r) => ({ id: r.id, name: r.name })) });
    },
    {
      name: 'list_categories',
      description:
        'List all available categories. Prefer reusing one — return kind:"existing" with the returned id; only propose a new category if none fits.',
      schema: z.object({}),
    },
  );
}
