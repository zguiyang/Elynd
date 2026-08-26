import { describe, expect, it } from 'vitest';

import { createChatModel } from '@/lib/llm/create-chat';
import type { ResolvedLlm } from '@/lib/llm/resolve';

function resolved(modelId: string, protocol: ResolvedLlm['protocol'] = 'chat-completions'): ResolvedLlm {
  return {
    modelRowId: 'row',
    providerId: 'provider',
    label: 'test',
    modelId,
    baseUrl: 'https://example.com/v1',
    apiKey: 'sk-test',
    protocol,
    temperature: 0.2,
    maxTokens: 2048,
  };
}

describe('createChatModel', () => {
  it('uses Chat Completions protocol by default (explicit opt-out)', () => {
    const chat = createChatModel(resolved('qwen3.7-plus'));
    expect(chat.useResponsesApi).toBe(false);
  });

  it('uses Responses API when the model protocol is responses', () => {
    const chat = createChatModel(resolved('qwen3.7-plus', 'responses'));
    expect(chat.useResponsesApi).toBe(true);
  });

  it('routing is driven by protocol config, not model name', () => {
    const chatCompletions = createChatModel(resolved('openai/gpt-5.4-pro'));
    expect(chatCompletions.useResponsesApi).toBe(false);

    const responses = createChatModel(resolved('deepseek-v4-flash', 'responses'));
    expect(responses.useResponsesApi).toBe(true);
  });

  it('passes through model params and base URL', () => {
    const chat = createChatModel(resolved('qwen3.7-plus', 'responses'), { timeoutMs: 30_000 });
    expect(chat.model).toBe('qwen3.7-plus');
    expect(chat.temperature).toBe(0.2);
    expect(chat.maxTokens).toBe(2048);
    expect(chat.clientConfig.baseURL).toBe('https://example.com/v1');
  });
});
