import { inArray } from 'drizzle-orm';

import { articleAudio as articleAudioTable } from '@gloaming/db';
import { type DerivedFreshness, type DerivedState } from '@gloaming/shared/api/articles';

import { db } from '@/db';
import { hashArticleContent } from '@/modules/articles/content-hash';

export type ArticleSourceInput = {
  id: string;
  title: string;
  body: string;
};

function audioStateForRows(rows: Array<{ status: string; contentHash: string }>, sourceHash: string): DerivedState {
  const ready = rows.filter((row) => row.status === 'ready');
  if (ready.length === 0) {
    return 'missing';
  }
  if (ready.some((row) => row.contentHash !== sourceHash)) {
    return 'stale';
  }
  return 'fresh';
}

/**
 * Pull-based derived freshness for registered kinds.
 * New kinds register here once they persist a source content hash.
 */
export async function getArticlesDerivedFreshness(
  articles: ArticleSourceInput[],
): Promise<Map<string, DerivedFreshness>> {
  const result = new Map<string, DerivedFreshness>();
  if (articles.length === 0) {
    return result;
  }

  const ids = articles.map((article) => article.id);
  const audioRows = await db
    .select({
      articleId: articleAudioTable.articleId,
      status: articleAudioTable.status,
      contentHash: articleAudioTable.contentHash,
    })
    .from(articleAudioTable)
    .where(inArray(articleAudioTable.articleId, ids));

  const audioByArticle = new Map<string, Array<{ status: string; contentHash: string }>>();
  for (const row of audioRows) {
    const list = audioByArticle.get(row.articleId) ?? [];
    list.push({ status: row.status, contentHash: row.contentHash });
    audioByArticle.set(row.articleId, list);
  }

  for (const article of articles) {
    const sourceHash = hashArticleContent(article.title, article.body);
    result.set(article.id, {
      audio: audioStateForRows(audioByArticle.get(article.id) ?? [], sourceHash),
    });
  }

  return result;
}

export async function getArticleDerivedFreshness(article: ArticleSourceInput): Promise<DerivedFreshness> {
  const map = await getArticlesDerivedFreshness([article]);
  return map.get(article.id) ?? { audio: 'missing' };
}
