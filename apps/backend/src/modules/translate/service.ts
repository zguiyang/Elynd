import { and, eq } from 'drizzle-orm';

import { article as articleTable } from '@elynd/db';
import {
  type BilingualCachePayload,
  bilingualCachePayloadSchema,
  type TranslateArticleBody,
} from '@elynd/shared/api/translate';

import { db } from '@/db';
import { NotFoundError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { composePromptMessages, PROMPT_ROLE, PROMPT_SCENE } from '@/lib/prompts';
import { getRedis } from '@/lib/redis';
import { streamAi } from '@/modules/ai';
import {
  createTranslateLineParser,
  formatSentenceListForPrompt,
  hashArticleContent,
  splitArticleSentences,
  type SplitSentence,
} from '@/modules/translate/split';

const translateLogger = rootLogger.child({ module: 'Translate' });

/** 30 days */
const BILINGUAL_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type TranslateStreamMetaEvent = {
  type: 'meta';
  contentHash: string;
  titleEn: string;
  sentences: SplitSentence[];
};

export type TranslateStreamTitleEvent = {
  type: 'title';
  zh: string;
};

export type TranslateStreamSentenceEvent = {
  type: 'sentence';
  index: number;
  zh: string;
};

export type TranslateStreamDoneEvent = {
  type: 'done';
  contentHash: string;
  cached: boolean;
};

export type TranslateStreamEvent =
  TranslateStreamMetaEvent | TranslateStreamTitleEvent | TranslateStreamSentenceEvent | TranslateStreamDoneEvent;

export type StreamTranslateArticleOptions = {
  signal?: AbortSignal;
};

function cacheKey(articleId: string, contentHash: string): string {
  return `elynd:bilingual:v1:${articleId}:${contentHash}`;
}

function bilingualCacheMatch(articleId: string): string {
  return `elynd:bilingual:v1:${articleId}:*`;
}

/** Best-effort: drop cached bilingual payloads for this article. */
export async function deleteBilingualCacheForArticle(articleId: string): Promise<void> {
  try {
    const redis = getRedis();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', bilingualCacheMatch(articleId), 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (error) {
    translateLogger.warn({ err: error, articleId }, 'Redis bilingual cache delete failed');
  }
}

async function loadPublishedArticle(articleId: string): Promise<{ id: string; title: string; body: string }> {
  const rows = await db
    .select({
      id: articleTable.id,
      title: articleTable.title,
      body: articleTable.body,
    })
    .from(articleTable)
    .where(and(eq(articleTable.id, articleId), eq(articleTable.status, 'published')))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NotFoundError('Article not found');
  }
  return row;
}

async function readCache(articleId: string, contentHash: string): Promise<BilingualCachePayload | null> {
  try {
    const raw = await getRedis().get(cacheKey(articleId, contentHash));
    if (!raw) {
      return null;
    }
    const parsed = bilingualCachePayloadSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      translateLogger.warn({ articleId, contentHash }, 'Invalid bilingual cache payload; ignoring');
      return null;
    }
    return parsed.data;
  } catch (error) {
    translateLogger.warn({ err: error, articleId }, 'Redis bilingual cache read failed');
    return null;
  }
}

async function writeCache(articleId: string, contentHash: string, payload: BilingualCachePayload): Promise<void> {
  try {
    await getRedis().set(cacheKey(articleId, contentHash), JSON.stringify(payload), 'EX', BILINGUAL_CACHE_TTL_SECONDS);
  } catch (error) {
    translateLogger.warn({ err: error, articleId }, 'Redis bilingual cache write failed');
  }
}

function* emitCachedPayload(contentHash: string, payload: BilingualCachePayload): Generator<TranslateStreamEvent> {
  yield {
    type: 'meta',
    contentHash,
    titleEn: payload.titleEn,
    sentences: payload.sentences.map(({ index, paragraphIndex, en }) => ({ index, paragraphIndex, en })),
  };
  yield { type: 'title', zh: payload.titleZh };
  for (const sentence of payload.sentences) {
    yield { type: 'sentence', index: sentence.index, zh: sentence.zh };
  }
  yield { type: 'done', contentHash, cached: true };
}

/**
 * Stream bilingual translation for a published article (Redis cache → AI line protocol).
 */
export async function* streamTranslateArticle(
  _userId: string,
  body: TranslateArticleBody,
  options: StreamTranslateArticleOptions = {},
): AsyncGenerator<TranslateStreamEvent> {
  const article = await loadPublishedArticle(body.articleId);
  const contentHash = hashArticleContent(article.title, article.body);
  const sentences = splitArticleSentences(article.body);

  const cached = await readCache(article.id, contentHash);
  if (cached) {
    yield* emitCachedPayload(contentHash, cached);
    return;
  }

  yield {
    type: 'meta',
    contentHash,
    titleEn: article.title,
    sentences,
  };

  if (sentences.length === 0 && !article.title.trim()) {
    yield { type: 'done', contentHash, cached: false };
    return;
  }

  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.translateArticle,
    actionId: 'translate',
    vars: {
      targetLanguage: 'English',
      replyLanguage: 'Chinese',
      titleEn: article.title,
      sentenceList: formatSentenceListForPrompt(sentences),
    },
  });

  const parser = createTranslateLineParser();
  let titleZh: string | null = null;
  const zhByIndex = new Map<number, string>();

  for await (const event of streamAi({
    purpose: 'translate',
    source: 'translate.article',
    userId: _userId,
    messages,
    signal: options.signal,
  })) {
    if (options.signal?.aborted) {
      return;
    }
    if (event.type === 'delta') {
      for (const line of parser.push(event.text)) {
        if (line.kind === 'title') {
          titleZh = line.zh;
          yield { type: 'title', zh: line.zh };
        } else {
          zhByIndex.set(line.index, line.zh);
          yield { type: 'sentence', index: line.index, zh: line.zh };
        }
      }
      continue;
    }

    // done from streamAi — flush remainder
    for (const line of parser.flush()) {
      if (line.kind === 'title') {
        if (titleZh == null) {
          titleZh = line.zh;
          yield { type: 'title', zh: line.zh };
        }
      } else if (!zhByIndex.has(line.index)) {
        zhByIndex.set(line.index, line.zh);
        yield { type: 'sentence', index: line.index, zh: line.zh };
      }
    }
  }

  if (options.signal?.aborted) {
    return;
  }

  const resolvedTitleZh = titleZh?.trim() || article.title.trim() || '（无标题）';
  const assembled: BilingualCachePayload = {
    titleEn: article.title,
    titleZh: resolvedTitleZh,
    sentences: sentences.map((sentence) => {
      const zh = zhByIndex.get(sentence.index)?.trim();
      if (!zh) {
        throw new Error(`Missing translation for sentence ${sentence.index}`);
      }
      return { ...sentence, zh };
    }),
  };

  // Title-only article (no sentences) still caches titleZh.
  if (assembled.sentences.length === 0 && !titleZh?.trim() && !article.title.trim()) {
    yield { type: 'done', contentHash, cached: false };
    return;
  }

  if (titleZh == null && article.title.trim()) {
    yield { type: 'title', zh: resolvedTitleZh };
  }

  await writeCache(article.id, contentHash, assembled);
  yield { type: 'done', contentHash, cached: false };
}
