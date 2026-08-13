/**
 * Prototype stub: local demo seed for Admin AI config UI.
 * Not persisted; not wired to Hono `/api/admin/llm/*` yet.
 */

import type { LlmAppSettingView, LlmModel, LlmProvider } from '@elynd/shared/api/llm-config';
import type { AiSettingKey } from '@elynd/shared/api/llm-config-keys';

const now = '2026-08-10T08:00:00.000Z';

export const MOCK_LLM_PROVIDERS: LlmProvider[] = [
  {
    id: 'prov_openai_compat',
    name: 'OpenAI 兼容网关',
    baseUrl: 'https://api.example.com/v1',
    isEnabled: true,
    apiKeySet: true,
    apiKeyMasked: 'sk-••••••••7f2a',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'prov_backup',
    name: '备用推理节点',
    baseUrl: 'https://llm-backup.internal/v1',
    isEnabled: false,
    apiKeySet: true,
    apiKeyMasked: 'sk-••••••••91bc',
    createdAt: now,
    updatedAt: now,
  },
];

export const MOCK_LLM_MODELS: LlmModel[] = [
  {
    id: 'mdl_gpt4o_mini',
    providerId: 'prov_openai_compat',
    modelId: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    temperature: 0.3,
    maxTokens: 2048,
    isEnabled: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mdl_gpt4o',
    providerId: 'prov_openai_compat',
    modelId: 'gpt-4o',
    label: 'GPT-4o',
    temperature: 0.4,
    maxTokens: 4096,
    isEnabled: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mdl_backup_flash',
    providerId: 'prov_backup',
    modelId: 'flash-lite',
    label: 'Flash Lite',
    temperature: 0.2,
    maxTokens: 1024,
    isEnabled: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  },
];

export const MOCK_LLM_SETTINGS: LlmAppSettingView[] = [
  {
    key: 'assist.default_model_id' satisfies AiSettingKey,
    modelId: 'mdl_gpt4o_mini',
    modelLabel: 'GPT-4o mini',
    healthy: true,
  },
];

export const AI_PURPOSE_LABELS: Record<AiSettingKey, { title: string; description: string }> = {
  'assist.default_model_id': {
    title: '阅读助手',
    description: '阅读页提问与划词帮助使用的默认模型。',
  },
};

export function maskApiKeyPreview(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length < 8) {
    return '••••••••';
  }
  return `${trimmed.slice(0, 3)}••••••••${trimmed.slice(-4)}`;
}

export function createLocalId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
