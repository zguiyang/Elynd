import { ChatOpenAI } from '@langchain/openai';

import type { ResolvedLlm } from '@/lib/llm/resolve';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 1;

/** Build a per-call ChatOpenAI instance from resolved DB config (no caching). */
export function createChatModel(resolved: ResolvedLlm, options?: { timeoutMs?: number }): ChatOpenAI {
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
  });
}
