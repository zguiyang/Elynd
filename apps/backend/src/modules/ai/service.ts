import type { BaseMessage, UsageMetadata } from '@langchain/core/messages';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { eq } from 'drizzle-orm';
import type { z, ZodTypeAny } from 'zod';

import { llmAppSetting as llmAppSettingTable } from '@elynd/db';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { createChatModel, type ResolvedLlm, resolveLlmByModelRowId } from '@/lib/llm';
import { recordInvocation, truncatePreview } from '@/modules/ai/log';
import { type AiPurpose, settingKeyForPurpose } from '@/modules/ai/purposes';

const DEFAULT_MAX_TOOL_ROUNDS = 3;

export type AiMessageInput = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiInvokeRef = {
  type: string;
  id: string;
};

export type AiInvokeOptions<TSchema extends ZodTypeAny | undefined = undefined> = {
  purpose?: AiPurpose;
  /** Explicit model row (admin test / future pin). Overrides purpose when set. */
  modelRowId?: string;
  source: string;
  userId?: string;
  ref?: AiInvokeRef;
  messages: AiMessageInput[];
  tools?: StructuredToolInterface[];
  outputSchema?: TSchema;
  maxToolRounds?: number;
  timeoutMs?: number;
  requestSummaryExtra?: Record<string, unknown>;
};

export type AiInvokeResult<T = string> = {
  content: T;
  model: { rowId: string; label: string; modelId: string };
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};

type TokenBucket = { inputTokens: number; outputTokens: number; totalTokens: number };

function emptyTokens(): TokenBucket {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(bucket: TokenBucket, usage?: UsageMetadata | null): void {
  if (!usage) {
    return;
  }
  bucket.inputTokens += usage.input_tokens ?? 0;
  bucket.outputTokens += usage.output_tokens ?? 0;
  const total = usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  bucket.totalTokens += total;
}

function toBaseMessages(messages: AiMessageInput[]): BaseMessage[] {
  return messages.map((message) => {
    if (message.role === 'system') {
      return new SystemMessage(message.content);
    }
    if (message.role === 'assistant') {
      return new AIMessage(message.content);
    }
    return new HumanMessage(message.content);
  });
}

function messageContentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : String(content);
}

function replyTextFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (
    content &&
    typeof content === 'object' &&
    'reply' in content &&
    typeof (content as { reply: unknown }).reply === 'string'
  ) {
    return (content as { reply: string }).reply;
  }
  return JSON.stringify(content);
}

async function resolveModelRowId(options: { modelRowId?: string; purpose?: AiPurpose }): Promise<string> {
  if (options.modelRowId) {
    return options.modelRowId;
  }
  const purpose = options.purpose ?? 'assist';
  const key = settingKeyForPurpose(purpose);
  const rows = await db.select().from(llmAppSettingTable).where(eq(llmAppSettingTable.key, key)).limit(1);
  const value = rows[0]?.value;
  if (!value) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable');
  }
  return value;
}

function buildRequestSummary(
  options: {
    messages: AiMessageInput[];
    tools?: StructuredToolInterface[];
    requestSummaryExtra?: Record<string, unknown>;
  },
  toolRoundCount: number,
) {
  const userText = options.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  return {
    messageCount: options.messages.length,
    selectionPreview: userText ? truncatePreview(userText) : undefined,
    selectionLength: userText.length || undefined,
    toolNames: options.tools?.map((t) => t.name),
    toolRoundCount,
    ...options.requestSummaryExtra,
  };
}

/**
 * Global AI entry: resolve purpose/model, invoke LangChain chat (optional tools), audit log.
 * Other modules must call this — not `lib/llm` directly for business invokes.
 */
export async function invokeAi<TSchema extends ZodTypeAny | undefined = undefined>(
  options: AiInvokeOptions<TSchema>,
): Promise<AiInvokeResult<TSchema extends ZodTypeAny ? z.infer<TSchema> : string>> {
  const started = Date.now();
  const tokens = emptyTokens();
  let resolved: ResolvedLlm | undefined;
  let toolRoundCount = 0;
  const purpose = options.purpose ?? (options.modelRowId ? null : 'assist');

  try {
    const modelRowId = await resolveModelRowId(options);
    resolved = await resolveLlmByModelRowId(modelRowId);
    const chat = createChatModel(resolved, { timeoutMs: options.timeoutMs });
    const conversation = toBaseMessages(options.messages);
    const tools = options.tools ?? [];
    const maxRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;

    let lastAi: AIMessage | undefined;

    if (tools.length > 0) {
      const bound = chat.bindTools(tools);
      for (let round = 0; round < maxRounds; round += 1) {
        const aiMessage = (await bound.invoke(conversation)) as AIMessage;
        addUsage(tokens, aiMessage.usage_metadata);
        lastAi = aiMessage;
        const toolCalls = aiMessage.tool_calls ?? [];
        if (toolCalls.length === 0) {
          break;
        }
        toolRoundCount += 1;
        conversation.push(aiMessage);
        for (const call of toolCalls) {
          const matched = tools.find((t) => t.name === call.name);
          if (!matched) {
            conversation.push(
              new ToolMessage({
                content: `Unknown tool: ${call.name}`,
                tool_call_id: call.id ?? call.name,
              }),
            );
            continue;
          }
          const raw = await matched.invoke(call.args);
          conversation.push(
            new ToolMessage({
              content: typeof raw === 'string' ? raw : JSON.stringify(raw),
              tool_call_id: call.id ?? call.name,
            }),
          );
        }
      }
    }

    type ContentOut = TSchema extends ZodTypeAny ? z.infer<TSchema> : string;
    let content: ContentOut;

    if (options.outputSchema) {
      const structured = chat.withStructuredOutput(options.outputSchema);
      content = (await structured.invoke(conversation)) as ContentOut;
    } else if (lastAi) {
      content = messageContentToString(lastAi.content) as ContentOut;
    } else {
      const aiMessage = (await chat.invoke(conversation)) as AIMessage;
      addUsage(tokens, aiMessage.usage_metadata);
      lastAi = aiMessage;
      content = messageContentToString(aiMessage.content) as ContentOut;
    }

    const replyText = replyTextFromContent(content);

    await recordInvocation({
      status: 'success',
      purpose,
      source: options.source,
      userId: options.userId,
      refType: options.ref?.type,
      refId: options.ref?.id,
      modelRowId: resolved.modelRowId,
      providerId: resolved.providerId,
      modelId: resolved.modelId,
      baseUrl: resolved.baseUrl,
      latencyMs: Date.now() - started,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
      requestSummary: buildRequestSummary(options, toolRoundCount),
      responseSummary: {
        replyPreview: truncatePreview(replyText),
        replyLength: replyText.length,
      },
    });

    return {
      content,
      model: { rowId: resolved.modelRowId, label: resolved.label, modelId: resolved.modelId },
      usage: tokens,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI invoke failed';
    const statusCode = error instanceof AppError ? error.statusCode : HTTP_STATUS.SERVICE_UNAVAILABLE;

    await recordInvocation({
      status: 'failure',
      errorCode: String(statusCode),
      errorMessage: message,
      purpose,
      source: options.source,
      userId: options.userId,
      refType: options.ref?.type,
      refId: options.ref?.id,
      modelRowId: resolved?.modelRowId,
      providerId: resolved?.providerId,
      modelId: resolved?.modelId,
      baseUrl: resolved?.baseUrl,
      latencyMs: Date.now() - started,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
      requestSummary: buildRequestSummary(options, toolRoundCount),
    });

    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable');
  }
}
