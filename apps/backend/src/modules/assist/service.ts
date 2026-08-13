import { and, eq } from 'drizzle-orm';

import { article as articleTable } from '@elynd/db';
import { type AssistAskBody } from '@elynd/shared/api/assist';

import { db } from '@/db';
import { NotFoundError } from '@/lib/errors';
import { type AiStreamEvent, streamAi } from '@/modules/ai';
import { createArticleAssistTools } from '@/modules/assist/tools';

function actionInstruction(actionId: AssistAskBody['actionId'], question?: string): string {
  switch (actionId) {
    case 'meaning':
    case 'explain':
      return 'Explain the selected text in clear Chinese for an English learner. Keep it short.';
    case 'simpler':
      return 'Rewrite the selected text in simpler English. Keep meaning. Be concise.';
    case 'referent':
      return 'Explain what pronouns or references in the selection point to, using the article context.';
    case 'lookup':
      return 'Explain the selected word or phrase in this article context (Chinese gloss + brief note).';
    case 'qa':
      return `Answer the learner question about the selection using the article. Question: ${question ?? ''}`;
    default:
      return 'Help the learner understand the selected text.';
  }
}

function neighborWindow(body: string, selection: string, radius = 120): string {
  const index = body.indexOf(selection);
  if (index < 0) {
    return '';
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(body.length, index + selection.length + radius);
  return body.slice(start, end);
}

export type StreamAssistAskOptions = {
  signal?: AbortSignal;
};

/**
 * Article-grounded assist as an async event stream (plain-text deltas + done).
 */
export async function* streamAssistAsk(
  userId: string,
  body: AssistAskBody,
  options?: StreamAssistAskOptions,
): AsyncGenerator<AiStreamEvent> {
  const rows = await db
    .select()
    .from(articleTable)
    .where(and(eq(articleTable.id, body.articleId), eq(articleTable.status, 'published')))
    .limit(1);
  const article = rows[0];
  if (!article) {
    throw new NotFoundError('Article');
  }

  const neighbor = neighborWindow(article.body, body.selection);
  const tools = createArticleAssistTools({ title: article.title, body: article.body });

  yield* streamAi({
    purpose: 'assist',
    source: 'assist.ask',
    userId,
    ref: { type: 'article', id: article.id },
    tools,
    signal: options?.signal,
    requestSummaryExtra: { actionId: body.actionId },
    messages: [
      {
        role: 'system',
        content: [
          'You are Elynd reading assist. Help adults understand the current English article.',
          'Stay grounded in the article. Use tools if you need more of the text.',
          'Respond in plain text only (no JSON). Prefer clear Chinese for explanations;',
          'use simpler English when the learner asks for a rewrite.',
          `Article title: ${article.title}`,
          `Article level: ${article.level}`,
          actionInstruction(body.actionId, body.question),
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Selection:\n${body.selection}`,
          neighbor ? `Nearby context:\n${neighbor}` : '',
          body.question ? `Learner question:\n${body.question}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
  });
}
