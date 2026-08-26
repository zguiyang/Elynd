import { ChatOpenAI } from '@langchain/openai';

import type { ResolvedLlm } from '@/lib/llm/resolve';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 1;

export type CreateChatModelOptions = {
  timeoutMs?: number;
};

/**
 * Build a per-call ChatOpenAI instance from resolved DB config (no caching).
 * The wire protocol (Chat Completions / Responses) comes from `llm_model.protocol`
 * — a config dimension, never a model-name special case. `useResponsesApi` is
 * always set explicitly so upstream routing changes cannot silently switch
 * endpoints for a provider that only speaks one protocol.
 */
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
    useResponsesApi: resolved.protocol === 'responses',
  });
}
