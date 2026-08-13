import { eq } from 'drizzle-orm';

import { llmModel as llmModelTable, llmProvider as llmProviderTable } from '@elynd/db';

import { HTTP_STATUS } from '@/constants';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { decryptApiKey } from '@/lib/llm/crypto';

export type ResolvedLlm = {
  modelRowId: string;
  providerId: string;
  label: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  temperature: number | null;
  maxTokens: number | null;
};

/**
 * Load an enabled model + provider and decrypt the API key.
 * Callers must pass a concrete model row id (purpose → setting lives in modules/ai).
 */
export async function resolveLlmByModelRowId(modelRowId: string): Promise<ResolvedLlm> {
  const rows = await db
    .select({
      modelRowId: llmModelTable.id,
      providerId: llmModelTable.providerId,
      label: llmModelTable.label,
      modelId: llmModelTable.modelId,
      temperature: llmModelTable.temperature,
      maxTokens: llmModelTable.maxTokens,
      modelEnabled: llmModelTable.isEnabled,
      baseUrl: llmProviderTable.baseUrl,
      apiKeyCiphertext: llmProviderTable.apiKeyCiphertext,
      providerEnabled: llmProviderTable.isEnabled,
    })
    .from(llmModelTable)
    .innerJoin(llmProviderTable, eq(llmModelTable.providerId, llmProviderTable.id))
    .where(eq(llmModelTable.id, modelRowId))
    .limit(1);

  const row = rows[0];
  if (!row || !row.modelEnabled || !row.providerEnabled) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable');
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(row.apiKeyCiphertext);
  } catch {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'AI unavailable');
  }

  return {
    modelRowId: row.modelRowId,
    providerId: row.providerId,
    label: row.label,
    modelId: row.modelId,
    baseUrl: row.baseUrl,
    apiKey,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
  };
}
