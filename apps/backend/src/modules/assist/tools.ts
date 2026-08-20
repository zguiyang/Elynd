import type { StructuredToolInterface } from '@langchain/core/tools';
import { tool } from 'langchain';
import { z } from 'zod';

import { type AssistAskBody } from '@gloaming/shared/api/assist';

const SLICE_MAX = 2000;

type ArticleRef = { title: string; body: string };

function createGetArticleSliceTool(article: ArticleRef) {
  return tool(
    async ({ offset, length }: { offset: number; length: number }) => {
      const start = Math.max(0, Math.min(offset, article.body.length));
      const size = Math.max(1, Math.min(length, SLICE_MAX));
      const text = article.body.slice(start, start + size);
      return JSON.stringify({ offset: start, length: text.length, text });
    },
    {
      name: 'get_article_slice',
      description:
        'Read a slice of the current article body by character offset and length. Use when nearby context is not enough for meaning, structure, or referents.',
      schema: z.object({
        offset: z.number().int().min(0).describe('0-based character offset'),
        length: z.number().int().min(1).max(SLICE_MAX).describe('Max characters to return'),
      }),
    },
  );
}

function createSearchArticleTool(article: ArticleRef) {
  return tool(
    async ({ query, window }: { query: string; window?: number }) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return JSON.stringify({ matches: [] });
      }
      const win = Math.min(Math.max(window ?? 80, 20), 200);
      const lower = article.body.toLowerCase();
      const matches: { index: number; excerpt: string }[] = [];
      let from = 0;
      while (matches.length < 5) {
        const index = lower.indexOf(q, from);
        if (index < 0) {
          break;
        }
        const start = Math.max(0, index - win);
        const end = Math.min(article.body.length, index + q.length + win);
        matches.push({ index, excerpt: article.body.slice(start, end) });
        from = index + q.length;
      }
      return JSON.stringify({ title: article.title, matches });
    },
    {
      name: 'search_article',
      description:
        'Search the current article body for a keyword and return nearby excerpts. Use for word-card examples or to locate related sentences.',
      schema: z.object({
        query: z.string().min(1).max(100),
        window: z.number().int().min(20).max(200).optional(),
      }),
    },
  );
}

/** Article-scoped tools — article body is closed over; model cannot pick another article. */
export function createArticleAssistTools(article: ArticleRef): StructuredToolInterface[] {
  return [createGetArticleSliceTool(article), createSearchArticleTool(article)];
}

/** Mount tools by assist action: lookup = search only; others = slice + search. */
export function resolveAssistToolsForAction(
  actionId: AssistAskBody['actionId'],
  article: ArticleRef,
): StructuredToolInterface[] {
  const search = createSearchArticleTool(article);
  if (actionId === 'lookup') {
    return [search];
  }
  return [createGetArticleSliceTool(article), search];
}
