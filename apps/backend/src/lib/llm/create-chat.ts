import { ChatOpenAI } from '@langchain/openai';

import { buildProxiedFetch } from '@/lib/llm/proxy';
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
 * endpoints for a provider that only speaks one protocol. Outbound proxy
 * follows `llm_provider.proxy_url` → env vars → direct (see proxy.ts).
 */
export function createChatModel(resolved: ResolvedLlm, options?: CreateChatModelOptions): ChatOpenAI {
  const proxiedFetch = buildProxiedFetch(resolved.proxyUrl);
  return new ChatOpenAI({
    model: resolved.modelId,
    apiKey: resolved.apiKey,
    temperature: resolved.temperature ?? undefined,
    maxTokens: resolved.maxTokens ?? undefined,
    timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
    configuration: {
      baseURL: resolved.baseUrl,
      ...(proxiedFetch ? { fetch: proxiedFetch } : {}),
    },
    useResponsesApi: resolved.protocol === 'responses',
  });
}
