import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { article as articleTable } from '@elynd/db';
import { type AssistAskBody } from '@elynd/shared/api/assist';

import { db } from '@/db';
import { NotFoundError } from '@/lib/errors';
import { composePromptMessages, PROMPT_ROLE, PROMPT_SCENE, type PromptMessage, renderPrompt } from '@/lib/prompts';
import { type AiStreamDeltaEvent, type AiStreamDoneEvent, invokeAi, streamAi } from '@/modules/ai';
import { truncatePreview } from '@/modules/ai/log';
import { resolveAssistToolsForAction } from '@/modules/assist/tools';

const followUpSuggestionsSchema = z.object({
  suggestions: z.array(z.string().min(1).max(48)).length(3),
});

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

export type AssistStreamDoneEvent = AiStreamDoneEvent & {
  suggestions?: string[];
};

export type AssistStreamEvent = AiStreamDeltaEvent | AssistStreamDoneEvent;

async function buildFollowUpMessages(input: {
  articleTitle: string;
  articleLevel: string;
  actionId: AssistAskBody['actionId'];
  selection?: string;
  question?: string;
  replyText: string;
}): Promise<PromptMessage[]> {
  const vars = {
    targetLanguage: 'English',
    replyLanguage: 'Chinese',
    articleTitle: input.articleTitle,
    articleLevel: input.articleLevel,
  };
  const [role, base, task] = await Promise.all([
    renderPrompt(`roles/${PROMPT_ROLE.languageTeacher}`, vars),
    renderPrompt(`scenes/${PROMPT_SCENE.assistRead}/base`, vars),
    renderPrompt(`scenes/${PROMPT_SCENE.assistRead}/follow-ups`, vars),
  ]);

  const userLines = [
    `Action: ${input.actionId}`,
    input.selection ? `Selection: ${truncatePreview(input.selection)}` : null,
    input.question ? `Question: ${truncatePreview(input.question)}` : null,
    `Assistant reply: ${truncatePreview(input.replyText)}`,
  ].filter((line): line is string => Boolean(line));

  return [
    { role: 'system', content: [role, base, task].filter(Boolean).join('\n\n') },
    { role: 'user', content: userLines.join('\n') },
  ];
}

/**
 * Article-grounded assist as an async event stream (plain-text deltas + done).
 * After the main reply, optionally attaches follow-up suggestion chips.
 */
export async function* streamAssistAsk(
  userId: string,
  body: AssistAskBody,
  options?: StreamAssistAskOptions,
): AsyncGenerator<AssistStreamEvent> {
  const rows = await db
    .select()
    .from(articleTable)
    .where(and(eq(articleTable.id, body.articleId), eq(articleTable.status, 'published')))
    .limit(1);
  const article = rows[0];
  if (!article) {
    throw new NotFoundError('Article');
  }

  const selection = body.selection?.trim() || undefined;
  const neighbor = selection ? neighborWindow(article.body, selection) : '';
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
      selection,
      selectionNote: selection
        ? undefined
        : 'No text selection — answer for the article as a whole (use tools if you need the body).',
      neighbor: neighbor || undefined,
      question: body.question?.trim() || undefined,
    },
  });

  let doneEvent: AiStreamDoneEvent | undefined;

  for await (const event of streamAi({
    purpose: 'assist',
    source: 'assist.ask',
    userId,
    ref: { type: 'article', id: article.id },
    tools,
    signal: options?.signal,
    requestSummaryExtra: { actionId: body.actionId },
    messages,
  })) {
    if (event.type === 'delta') {
      yield event;
      continue;
    }
    doneEvent = event;
  }

  if (!doneEvent) {
    return;
  }

  if (options?.signal?.aborted) {
    return;
  }

  let suggestions: string[] | undefined;
  try {
    const followUpMessages = await buildFollowUpMessages({
      articleTitle: article.title,
      articleLevel: article.level,
      actionId: body.actionId,
      selection,
      question: body.question?.trim() || undefined,
      replyText: doneEvent.content,
    });
    const followUp = await invokeAi({
      purpose: 'assist',
      source: 'assist.ask.followups',
      userId,
      ref: { type: 'article', id: article.id },
      messages: followUpMessages,
      outputSchema: followUpSuggestionsSchema,
      timeoutMs: 20_000,
      requestSummaryExtra: { actionId: body.actionId, phase: 'followups' },
    });
    suggestions = followUp.content.suggestions;
  } catch {
    // Follow-ups are optional — main reply still ships.
  }

  if (options?.signal?.aborted) {
    return;
  }

  yield {
    ...doneEvent,
    ...(suggestions ? { suggestions } : {}),
  };
}
