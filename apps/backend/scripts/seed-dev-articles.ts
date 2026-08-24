/**
 * Idempotent dev seed: ensures at least one published article for Discover → Reader.
 * Run: pnpm --filter @gloaming/backend seed:dev
 */
import { eq } from 'drizzle-orm';

import { article as articleTable } from '@gloaming/db';

import { db } from '../src/db/index.ts';
import { createArticle, publishArticle } from '../src/modules/articles/service.ts';

const SEED_SOURCE_NOTE = 'dev-seed:v1';
const SEED_TITLE = '[dev-seed] Morning Light';

const SEED_BODY = `The first light touched the water before anyone else was awake.

A fisherman named Elias stood at the pier with his coffee, watching the harbor wake in slow motion. Gulls argued over scraps. Ropes creaked against wood.

He had read the same paragraph in an old magazine the night before—something about patience and small habits. It sounded simple until the morning made it real.

When the sun cleared the rooflines, Elias decided he would read one more page before work. Just one. Then another if the day allowed.

The sea did not hurry. Neither would he.`;

async function main() {
  const [existing] = await db
    .select({ id: articleTable.id, status: articleTable.status })
    .from(articleTable)
    .where(eq(articleTable.sourceNote, SEED_SOURCE_NOTE))
    .limit(1);

  if (existing?.status === 'published') {
    console.log(`Dev seed article already published: ${existing.id}`);
    process.exit(0);
  }

  let articleId = existing?.id;
  if (!articleId) {
    const created = await createArticle({
      title: SEED_TITLE,
      body: SEED_BODY,
      level: 'easy',
      themes: ['story', 'daily-life'],
      sourceNote: SEED_SOURCE_NOTE,
      estimatedMinutes: 5,
      seriesId: null,
      seriesOrder: null,
    });
    articleId = created.id;
    console.log(`Created draft article: ${articleId}`);
  }

  const published = await publishArticle(articleId);
  console.log(`Published dev seed article: ${published.id} — "${published.title}"`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Dev seed failed:', error);
  process.exit(1);
});
