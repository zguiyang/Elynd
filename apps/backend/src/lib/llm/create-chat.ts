import { ChatOpenAI } from '@langchain/openai';

import type { ResolvedLlm } from '@/lib/llm/resolve';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 1;

export type CreateChatModelOptions = {
  timeoutMs?: number;
  /** DeepSeek V4 thinks by default; reasoning tokens consume max_tokens and can truncate JSON. */
  thinking?: 'disabled';
};

function modelKwargsFor(resolved: ResolvedLlm, options?: CreateChatModelOptions): Record<string, unknown> {
  if (options?.thinking !== 'disabled') {
    return {};
  }
  if (!resolved.modelId.toLowerCase().includes('deepseek')) {
    return {};
  }
  return { thinking: { type: 'disabled' } };
}

/** Build a per-call ChatOpenAI instance from resolved DB config (no caching). */
export function createChatModel(resolved: ResolvedLlm, options?: CreateChatModelOptions): ChatOpenAI {
  return new ChatOpenAI({
    model: resolved.modelId,
    apiKey: resolved.apiKey,
    temperature: resolved.temperature ?? undefined,
    maxTokens: resolved.maxTokens ?? undefined,
    timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
    configuration: {
      baseURL: resolved.baseUrl,
    },
    modelKwargs: modelKwargsFor(resolved, options),
  });
}
