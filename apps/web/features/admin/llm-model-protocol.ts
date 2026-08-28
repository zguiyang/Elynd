import { LLM_MODEL_PROTOCOLS, type LlmModelProtocol } from '@gloaming/shared/api/llm-config';

/** Per-model wire protocol options (OpenAI-compatible community mainstream). */
export const LLM_MODEL_PROTOCOL_OPTIONS: {
  value: LlmModelProtocol;
  label: string;
  endpoint: string;
  description: string;
}[] = [
  {
    value: 'chat-completions',
    label: 'Chat Completions',
    endpoint: '/v1/chat/completions',
    description: '默认协议，兼容性最好，适用于大多数 OpenAI 兼容网关。',
  },
  {
    value: 'responses',
    label: 'Responses API',
    endpoint: '/v1/responses',
    description: 'OpenAI 新响应协议；网关同时提供双端点时可按模型单独启用。',
  },
];

export function isLlmModelProtocol(value: string): value is LlmModelProtocol {
  return (LLM_MODEL_PROTOCOLS as readonly string[]).includes(value);
}

export function llmModelProtocolLabel(protocol: LlmModelProtocol): string {
  return LLM_MODEL_PROTOCOL_OPTIONS.find((option) => option.value === protocol)?.label ?? protocol;
}
