import { randomUUID } from 'node:crypto';

import { and, asc, eq, inArray } from 'drizzle-orm';

import {
  llmAppSetting as llmAppSettingTable,
  llmModel as llmModelTable,
  llmProvider as llmProviderTable,
} from '@gloaming/db';
import {
  type CreateLlmModelBody,
  type CreateLlmProviderBody,
  type LlmAppSettingView,
  type LlmModel,
  type LlmModelListQuery,
  type LlmProvider,
  type PutLlmAppSettingBody,
  type TestLlmProviderBody,
  type TestLlmProviderResult,
  type UpdateLlmModelBody,
  type UpdateLlmProviderBody,
} from '@gloaming/shared/api/llm-config';
import { AI_SETTING_KEY_VALUES, type AiSettingKey } from '@gloaming/shared/api/llm-config-keys';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError, NotFoundError } from '@/lib/errors';
import { decryptApiKey, encryptApiKey, maskApiKey } from '@/lib/llm';
import { invokeAi } from '@/modules/ai';
import { isAiSettingKey } from '@/modules/ai/purposes';

type ProviderRow = typeof llmProviderTable.$inferSelect;
type ModelRow = typeof llmModelTable.$inferSelect;

function toProvider(row: ProviderRow): LlmProvider {
  let apiKeyMasked: string | null = null;
  try {
    apiKeyMasked = maskApiKey(decryptApiKey(row.apiKeyCiphertext));
  } catch {
    apiKeyMasked = '****';
  }
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    proxyUrl: row.proxyUrl ?? null,
    isEnabled: row.isEnabled,
    apiKeySet: true,
    apiKeyMasked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toModel(row: ModelRow): LlmModel {
  return {
    id: row.id,
    providerId: row.providerId,
    modelId: row.modelId,
    label: row.label,
    protocol: row.protocol,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    isEnabled: row.isEnabled,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function settingReferencesModel(modelIds: string[]): Promise<boolean> {
  if (modelIds.length === 0) {
    return false;
  }
  const rows = await db
    .select({ value: llmAppSettingTable.value })
    .from(llmAppSettingTable)
    .where(inArray(llmAppSettingTable.value, modelIds))
    .limit(1);
  return rows.length > 0;
}

export async function listProviders(): Promise<LlmProvider[]> {
  const rows = await db.select().from(llmProviderTable).orderBy(asc(llmProviderTable.createdAt));
  return rows.map(toProvider);
}

export async function createProvider(body: CreateLlmProviderBody): Promise<LlmProvider> {
  const id = randomUUID();
  const [row] = await db
    .insert(llmProviderTable)
    .values({
      id,
      name: body.name,
      baseUrl: body.baseUrl,
      apiKeyCiphertext: encryptApiKey(body.apiKey),
      proxyUrl: body.proxyUrl ?? null,
      isEnabled: body.isEnabled,
    })
    .returning();
  return toProvider(row!);
}

export async function updateProvider(id: string, body: UpdateLlmProviderBody): Promise<LlmProvider> {
  const existing = await db.select().from(llmProviderTable).where(eq(llmProviderTable.id, id)).limit(1);
  if (!existing[0]) {
    throw new NotFoundError('LLM provider');
  }

  const patch: Partial<typeof llmProviderTable.$inferInsert> = {};
  if (body.name !== undefined) {
    patch.name = body.name;
  }
  if (body.baseUrl !== undefined) {
    patch.baseUrl = body.baseUrl;
  }
  if (body.proxyUrl !== undefined) {
    patch.proxyUrl = body.proxyUrl;
  }
  if (body.isEnabled !== undefined) {
    patch.isEnabled = body.isEnabled;
  }
  if (body.apiKey !== undefined) {
    patch.apiKeyCiphertext = encryptApiKey(body.apiKey);
  }

  const [row] = await db.update(llmProviderTable).set(patch).where(eq(llmProviderTable.id, id)).returning();
  return toProvider(row!);
}

export async function deleteProvider(id: string): Promise<void> {
  const existing = await db.select().from(llmProviderTable).where(eq(llmProviderTable.id, id)).limit(1);
  if (!existing[0]) {
    throw new NotFoundError('LLM provider');
  }

  const models = await db.select({ id: llmModelTable.id }).from(llmModelTable).where(eq(llmModelTable.providerId, id));
  if (await settingReferencesModel(models.map((m) => m.id))) {
    throw new AppError(HTTP_STATUS.CONFLICT, 'Provider models are referenced by app settings');
  }

  await db.delete(llmProviderTable).where(eq(llmProviderTable.id, id));
}

export async function listModels(query: LlmModelListQuery): Promise<LlmModel[]> {
  const rows = query.providerId
    ? await db
        .select()
        .from(llmModelTable)
        .where(eq(llmModelTable.providerId, query.providerId))
        .orderBy(asc(llmModelTable.sortOrder), asc(llmModelTable.createdAt))
    : await db.select().from(llmModelTable).orderBy(asc(llmModelTable.sortOrder), asc(llmModelTable.createdAt));
  return rows.map(toModel);
}

export async function createModel(body: CreateLlmModelBody): Promise<LlmModel> {
  const provider = await db.select().from(llmProviderTable).where(eq(llmProviderTable.id, body.providerId)).limit(1);
  if (!provider[0]) {
    throw new NotFoundError('LLM provider');
  }

  const id = randomUUID();
  try {
    const [row] = await db
      .insert(llmModelTable)
      .values({
        id,
        providerId: body.providerId,
        modelId: body.modelId,
        label: body.label,
        protocol: body.protocol,
        temperature: body.temperature ?? null,
        maxTokens: body.maxTokens ?? null,
        isEnabled: body.isEnabled,
        sortOrder: body.sortOrder,
      })
      .returning();
    return toModel(row!);
  } catch {
    throw new AppError(HTTP_STATUS.CONFLICT, 'Model id already exists for this provider');
  }
}

export async function updateModel(id: string, body: UpdateLlmModelBody): Promise<LlmModel> {
  const existing = await db.select().from(llmModelTable).where(eq(llmModelTable.id, id)).limit(1);
  if (!existing[0]) {
    throw new NotFoundError('LLM model');
  }

  const patch: Partial<typeof llmModelTable.$inferInsert> = {};
  if (body.modelId !== undefined) {
    patch.modelId = body.modelId;
  }
  if (body.label !== undefined) {
    patch.label = body.label;
  }
  if (body.protocol !== undefined) {
    patch.protocol = body.protocol;
  }
  if (body.temperature !== undefined) {
    patch.temperature = body.temperature;
  }
  if (body.maxTokens !== undefined) {
    patch.maxTokens = body.maxTokens;
  }
  if (body.isEnabled !== undefined) {
    patch.isEnabled = body.isEnabled;
  }
  if (body.sortOrder !== undefined) {
    patch.sortOrder = body.sortOrder;
  }

  try {
    const [row] = await db.update(llmModelTable).set(patch).where(eq(llmModelTable.id, id)).returning();
    return toModel(row!);
  } catch {
    throw new AppError(HTTP_STATUS.CONFLICT, 'Model id already exists for this provider');
  }
}

export async function deleteModel(id: string): Promise<void> {
  const existing = await db.select().from(llmModelTable).where(eq(llmModelTable.id, id)).limit(1);
  if (!existing[0]) {
    throw new NotFoundError('LLM model');
  }
  if (await settingReferencesModel([id])) {
    throw new AppError(HTTP_STATUS.CONFLICT, 'Model is referenced by app settings');
  }
  await db.delete(llmModelTable).where(eq(llmModelTable.id, id));
}

export async function listSettings(): Promise<LlmAppSettingView[]> {
  const settings = await db.select().from(llmAppSettingTable);
  const byKey = new Map(settings.map((s) => [s.key, s.value]));
  const modelIds = [...new Set([...byKey.values()].filter(Boolean))];
  const models =
    modelIds.length > 0
      ? await db
          .select({
            id: llmModelTable.id,
            label: llmModelTable.label,
            modelEnabled: llmModelTable.isEnabled,
            providerEnabled: llmProviderTable.isEnabled,
          })
          .from(llmModelTable)
          .innerJoin(llmProviderTable, eq(llmModelTable.providerId, llmProviderTable.id))
          .where(inArray(llmModelTable.id, modelIds))
      : [];
  const modelById = new Map(models.map((m) => [m.id, m]));

  return AI_SETTING_KEY_VALUES.map((key) => {
    const modelId = byKey.get(key) ?? null;
    const model = modelId ? modelById.get(modelId) : undefined;
    return {
      key,
      modelId: model ? model.id : modelId,
      modelLabel: model?.label ?? null,
      healthy: Boolean(model?.modelEnabled && model.providerEnabled),
    };
  });
}

export async function putSetting(key: string, body: PutLlmAppSettingBody): Promise<LlmAppSettingView> {
  if (!isAiSettingKey(key)) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Unknown setting key');
  }

  const models = await db
    .select({
      id: llmModelTable.id,
      label: llmModelTable.label,
      modelEnabled: llmModelTable.isEnabled,
      providerEnabled: llmProviderTable.isEnabled,
    })
    .from(llmModelTable)
    .innerJoin(llmProviderTable, eq(llmModelTable.providerId, llmProviderTable.id))
    .where(eq(llmModelTable.id, body.modelId))
    .limit(1);

  const model = models[0];
  if (!model) {
    throw new NotFoundError('LLM model');
  }
  if (!model.modelEnabled || !model.providerEnabled) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Model or provider is disabled');
  }

  await db
    .insert(llmAppSettingTable)
    .values({ key: key as AiSettingKey, value: body.modelId })
    .onConflictDoUpdate({
      target: llmAppSettingTable.key,
      set: { value: body.modelId, updatedAt: new Date() },
    });

  return {
    key: key as AiSettingKey,
    modelId: model.id,
    modelLabel: model.label,
    healthy: true,
  };
}

export async function testProvider(providerId: string, body: TestLlmProviderBody): Promise<TestLlmProviderResult> {
  const provider = await db.select().from(llmProviderTable).where(eq(llmProviderTable.id, providerId)).limit(1);
  if (!provider[0]) {
    throw new NotFoundError('LLM provider');
  }
  if (!provider[0].isEnabled) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Provider is disabled');
  }

  let modelRowId = body.modelId;
  if (!modelRowId) {
    const models = await db
      .select()
      .from(llmModelTable)
      .where(and(eq(llmModelTable.providerId, providerId), eq(llmModelTable.isEnabled, true)))
      .orderBy(asc(llmModelTable.sortOrder), asc(llmModelTable.createdAt))
      .limit(1);
    modelRowId = models[0]?.id;
  } else {
    const models = await db
      .select()
      .from(llmModelTable)
      .where(and(eq(llmModelTable.id, modelRowId), eq(llmModelTable.providerId, providerId)))
      .limit(1);
    if (!models[0]) {
      throw new NotFoundError('LLM model');
    }
  }

  if (!modelRowId) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'No enabled model on this provider');
  }

  const started = Date.now();
  const result = await invokeAi({
    modelRowId,
    source: 'admin.provider_test',
    messages: [
      { role: 'system', content: 'Reply with exactly: ok' },
      { role: 'user', content: 'ping' },
    ],
    timeoutMs: 30_000,
  });

  return {
    ok: true,
    latencyMs: Date.now() - started,
    modelLabel: result.model.label,
  };
}
