import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { llmAppSetting as llmAppSettingTable, llmProvider as llmProviderTable, user as userTable } from '@elynd/db';
import type { LlmAppSettingView, LlmModel, LlmProvider } from '@elynd/shared/api/llm-config';
import { AUTH_ADMIN_ROLE } from '@elynd/shared/auth/policy';

import app from '@/app';
import { db } from '@/db';
import * as aiService from '@/modules/ai/service';

const password = 'password123';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function cookieHeader(response: Response): string {
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (getSetCookie?.length) {
    return getSetCookie.map((entry) => entry.split(';')[0]).join('; ');
  }
  const single = response.headers.get('set-cookie');
  return single ? single.split(';')[0]! : '';
}

async function signUp(input: { email: string; username: string; name: string }) {
  return app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: input.email,
      password,
      name: input.name,
      username: input.username,
    }),
  });
}

async function markEmailVerified(email: string) {
  await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));
}

async function setUserRole(email: string, role: string) {
  await db.update(userTable).set({ role }).where(eq(userTable.email, email));
}

async function signInEmail(email: string) {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email, password }),
  });
}

async function createSession(role: 'user' | 'admin' = 'user') {
  const email = uniqueEmail(role);
  const username = `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  expect((await signUp({ email, username, name: role })).status).toBe(200);
  await markEmailVerified(email);
  if (role === 'admin') {
    await setUserRole(email, AUTH_ADMIN_ROLE);
  }
  const login = await signInEmail(email);
  expect(login.status).toBe(200);
  return { email, cookie: cookieHeader(login) };
}

describe('LLM config HTTP', () => {
  const createdEmails: string[] = [];
  const createdProviderIds: string[] = [];

  afterAll(async () => {
    if (createdProviderIds.length > 0) {
      await db.delete(llmProviderTable).where(inArray(llmProviderTable.id, createdProviderIds));
    }
    await db.delete(llmAppSettingTable).where(eq(llmAppSettingTable.key, 'assist.default_model_id'));
    for (const email of createdEmails) {
      await db.delete(userTable).where(eq(userTable.email, email));
    }
  });

  it('manages providers, models, settings without leaking API keys', async () => {
    const admin = await createSession('admin');
    createdEmails.push(admin.email);

    const createProvider = await app.request('/api/admin/llm/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        name: 'Test Gateway',
        baseUrl: 'https://example.com/v1',
        apiKey: 'sk-test-secret-abcdef',
      }),
    });
    expect(createProvider.status).toBe(201);
    const provider = (await createProvider.json()) as LlmProvider;
    createdProviderIds.push(provider.id);
    expect(provider.apiKeySet).toBe(true);
    expect(provider.apiKeyMasked).toContain('…');
    expect(JSON.stringify(provider)).not.toContain('sk-test-secret-abcdef');

    const createModel = await app.request('/api/admin/llm/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({
        providerId: provider.id,
        modelId: 'gpt-test',
        label: 'Test Model',
        temperature: 0.2,
      }),
    });
    expect(createModel.status).toBe(201);
    const model = (await createModel.json()) as LlmModel;
    expect(model.modelId).toBe('gpt-test');

    const putSetting = await app.request('/api/admin/llm/settings/assist.default_model_id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({ modelId: model.id }),
    });
    expect(putSetting.status).toBe(200);
    const setting = (await putSetting.json()) as LlmAppSettingView;
    expect(setting.healthy).toBe(true);
    expect(setting.modelId).toBe(model.id);

    const deleteModelBlocked = await app.request(`/api/admin/llm/models/${model.id}`, {
      method: 'DELETE',
      headers: { cookie: admin.cookie },
    });
    expect(deleteModelBlocked.status).toBe(409);

    const invokeSpy = vi.spyOn(aiService, 'invokeAi').mockResolvedValue({
      content: 'ok',
      model: { rowId: model.id, label: model.label, modelId: model.modelId },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    });

    const testProvider = await app.request(`/api/admin/llm/providers/${provider.id}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: admin.cookie },
      body: JSON.stringify({}),
    });
    expect(testProvider.status).toBe(200);
    expect(invokeSpy).toHaveBeenCalled();
    invokeSpy.mockRestore();

    await db.delete(llmAppSettingTable).where(eq(llmAppSettingTable.key, 'assist.default_model_id'));

    const deleteModel = await app.request(`/api/admin/llm/models/${model.id}`, {
      method: 'DELETE',
      headers: { cookie: admin.cookie },
    });
    expect(deleteModel.status).toBe(204);

    const deleteProvider = await app.request(`/api/admin/llm/providers/${provider.id}`, {
      method: 'DELETE',
      headers: { cookie: admin.cookie },
    });
    expect(deleteProvider.status).toBe(204);
    createdProviderIds.length = 0;
  });
});
