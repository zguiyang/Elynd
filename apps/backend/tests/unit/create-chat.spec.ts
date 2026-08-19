import { describe, expect, it } from 'vitest';

import { createChatModel } from '@/lib/llm/create-chat';
import type { ResolvedLlm } from '@/lib/llm/resolve';

function resolved(modelId: string): ResolvedLlm {
  return {
    modelRowId: 'row',
    providerId: 'provider',
    label: 'test',
    modelId,
    baseUrl: 'https://example.com/v1',
    apiKey: 'sk-test',
    temperature: 0.2,
    maxTokens: 2048,
  };
}

describe('createChatModel', () => {
  it('disables DeepSeek thinking when requested', () => {
    const chat = createChatModel(resolved('deepseek-v4-flash'), { thinking: 'disabled' });
    expect(chat.modelKwargs).toEqual({ thinking: { type: 'disabled' } });
  });

  it('does not send thinking to non-DeepSeek models', () => {
    const chat = createChatModel(resolved('gpt-4o-mini'), { thinking: 'disabled' });
    expect(chat.modelKwargs).toEqual({});
  });
});
