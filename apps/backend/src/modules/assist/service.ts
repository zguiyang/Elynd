import { and, eq } from 'drizzle-orm';

import { article as articleTable } from '@elynd/db';
import { type AssistAskBody } from '@elynd/shared/api/assist';

import { db } from '@/db';
import { NotFoundError } from '@/lib/errors';
import { composePromptMessages, PROMPT_ROLE, PROMPT_SCENE } from '@/lib/prompts';
import { type AiStreamEvent, streamAi } from '@/modules/ai';
import { resolveAssistToolsForAction } from '@/modules/assist/tools';

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
  const tools = resolveAssistToolsForAction(body.actionId, {
    title: article.title,
    body: article.body,
  });

  const messages = await composePromptMessages({
    roleId: PROMPT_ROLE.languageTeacher,
    sceneId: PROMPT_SCENE.assistRead,
    actionId: body.actionId,
    vars: {
      targetLanguage: 'English',
      replyLanguage: 'Chinese',
      articleTitle: article.title,
      articleLevel: article.level,
      selection: body.selection,
      neighbor: neighbor || undefined,
      question: body.question?.trim() || undefined,
    },
  });

  yield* streamAi({
    purpose: 'assist',
    source: 'assist.ask',
    userId,
    ref: { type: 'article', id: article.id },
    tools,
    signal: options?.signal,
    requestSummaryExtra: { actionId: body.actionId },
    messages,
  });
}
