import { z } from 'zod';

import { AI_SETTING_KEY_VALUES } from '@gloaming/shared/api/llm-config-keys';

export const llmProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  proxyUrl: z.string().nullable(),
  thinkingParam: z.string().nullable(),
  isEnabled: z.boolean(),
  apiKeySet: z.boolean(),
  apiKeyMasked: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type LlmProvider = z.infer<typeof llmProviderSchema>;

export const createLlmProviderBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().min(1).max(2000),
  proxyUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => /^(https?|socks5):\/\//i.test(value), { message: '代理地址需为 http/https/socks5' })
    .optional()
    .nullable(),
  thinkingParam: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: '思考参数名需为合法标识符' })
    .optional()
    .nullable(),
  isEnabled: z.boolean().optional().default(true),
});

export type CreateLlmProviderBody = z.infer<typeof createLlmProviderBodySchema>;

export const updateLlmProviderBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    baseUrl: z.string().trim().url().max(500).optional(),
    apiKey: z.string().min(1).max(2000).optional(),
    proxyUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .refine((value) => /^(https?|socks5):\/\//i.test(value), { message: '代理地址需为 http/https/socks5' })
      .optional()
      .nullable(),
    thinkingParam: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: '思考参数名需为合法标识符' })
      .optional()
      .nullable(),
    isEnabled: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

export type UpdateLlmProviderBody = z.infer<typeof updateLlmProviderBodySchema>;

export const LLM_MODEL_PROTOCOLS = ['chat-completions', 'responses'] as const;

export type LlmModelProtocol = (typeof LLM_MODEL_PROTOCOLS)[number];

export const llmModelSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  label: z.string(),
  protocol: z.enum(LLM_MODEL_PROTOCOLS),
  temperature: z.number().nullable(),
  maxTokens: z.number().int().nullable(),
  isEnabled: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type LlmModel = z.infer<typeof llmModelSchema>;

export const createLlmModelBodySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(120),
  protocol: z.enum(LLM_MODEL_PROTOCOLS).optional().default('chat-completions'),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxTokens: z.number().int().positive().max(1_000_000).nullable().optional(),
  isEnabled: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
});

export type CreateLlmModelBody = z.infer<typeof createLlmModelBodySchema>;

export const updateLlmModelBodySchema = z
  .object({
    modelId: z.string().trim().min(1).max(200).optional(),
    label: z.string().trim().min(1).max(120).optional(),
    protocol: z.enum(LLM_MODEL_PROTOCOLS).optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    maxTokens: z.number().int().positive().max(1_000_000).nullable().optional(),
    isEnabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

export type UpdateLlmModelBody = z.infer<typeof updateLlmModelBodySchema>;

export const llmModelListQuerySchema = z.object({
  providerId: z.string().min(1).optional(),
});

export type LlmModelListQuery = z.infer<typeof llmModelListQuerySchema>;

export const llmAppSettingSchema = z.object({
  key: z.enum(AI_SETTING_KEY_VALUES),
  modelId: z.string().nullable(),
  modelLabel: z.string().nullable(),
  healthy: z.boolean(),
});

export type LlmAppSettingView = z.infer<typeof llmAppSettingSchema>;

export const putLlmAppSettingBodySchema = z.object({
  modelId: z.string().min(1),
});

export type PutLlmAppSettingBody = z.infer<typeof putLlmAppSettingBodySchema>;

export const testLlmProviderBodySchema = z.object({
  modelId: z.string().min(1).optional(),
});

export type TestLlmProviderBody = z.infer<typeof testLlmProviderBodySchema>;

export const testLlmProviderResultSchema = z.object({
  ok: z.literal(true),
  latencyMs: z.number().int().nonnegative(),
  modelLabel: z.string(),
});

export type TestLlmProviderResult = z.infer<typeof testLlmProviderResultSchema>;
