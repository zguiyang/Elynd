import { randomUUID } from 'node:crypto';

import {
  aiInvocationLog as aiInvocationLogTable,
  type AiInvocationRequestSummary,
  type AiInvocationResponseSummary,
} from '@elynd/db';

import { db } from '@/db';

const PREVIEW_MAX = 200;
const ERROR_MESSAGE_MAX = 500;

export type InvocationLogInput = {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  purpose?: string | null;
  source: string;
  userId?: string | null;
  refType?: string | null;
  refId?: string | null;
  modelRowId?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  baseUrl?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  requestSummary?: AiInvocationRequestSummary | null;
  responseSummary?: AiInvocationResponseSummary | null;
};

export function truncatePreview(text: string, max = PREVIEW_MAX): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function truncateErrorMessage(message: string): string {
  return truncatePreview(message, ERROR_MESSAGE_MAX);
}

/** Persist one business-level AI invocation (summary A — no full prompts). */
export async function recordInvocation(input: InvocationLogInput): Promise<void> {
  await db.insert(aiInvocationLogTable).values({
    id: randomUUID(),
    status: input.status,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ? truncateErrorMessage(input.errorMessage) : null,
    purpose: input.purpose ?? null,
    source: input.source,
    userId: input.userId ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    modelRowId: input.modelRowId ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    baseUrl: input.baseUrl ?? null,
    latencyMs: input.latencyMs ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    totalTokens: input.totalTokens ?? null,
    costAmount: null,
    costCurrency: null,
    requestSummary: input.requestSummary ?? null,
    responseSummary: input.responseSummary ?? null,
  });
}
