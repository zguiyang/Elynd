import { ChatOpenAI } from '@langchain/openai';

import { buildProxiedFetch } from '@/lib/llm/proxy';
import type { ResolvedLlm } from '@/lib/llm/resolve';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 1;

export type CreateChatModelOptions = {
  timeoutMs?: number;
  /** Thinking-mode toggle; the wire parameter name comes from `ResolvedLlm.thinkingParam`. */
  enableThinking?: boolean;
};

/**
 * Build a per-call ChatOpenAI instance from resolved DB config (no caching).
 * The wire protocol (Chat Completions / Responses) comes from `llm_model.protocol`
 * — a config dimension, never a model-name special case. `useResponsesApi` is
 * always set explicitly so upstream routing changes cannot silently switch
 * endpoints for a provider that only speaks one protocol. Outbound proxy
 * follows `llm_provider.proxy_url` → env vars → direct (see proxy.ts).
 *
 * Thinking toggle is fully dynamic: `resolved.thinkingParam` supplies the
 * provider-specific parameter name (e.g. `enable_thinking`), and the boolean
 * value comes from `options.enableThinking`. When the parameter name is
 * unset, nothing is passed and the platform default applies.
 */
export function createChatModel(resolved: ResolvedLlm, options?: CreateChatModelOptions): ChatOpenAI {
  const proxiedFetch = buildProxiedFetch(resolved.proxyUrl);
  const modelKwargs =
    resolved.thinkingParam && options?.enableThinking !== undefined
      ? { [resolved.thinkingParam]: options.enableThinking }
      : undefined;
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
    ...(modelKwargs ? { modelKwargs } : {}),
    useResponsesApi: resolved.protocol === 'responses',
  });
}
