import { Hono } from 'hono';

import { HTTP_STATUS } from '@/constants';
import { type AuthVariables, requireAdmin } from '@/middleware/auth';
import * as llmConfigService from '@/modules/llm-config/service';
import {
  validateCreateModel,
  validateCreateProvider,
  validateModelListQuery,
  validatePutSetting,
  validateTestProvider,
  validateUpdateModel,
  validateUpdateProvider,
} from '@/modules/llm-config/validator';

export const llmConfigRoutes = new Hono<{ Variables: AuthVariables }>();

llmConfigRoutes.get('/api/admin/llm/wire-registry', requireAdmin, async (c) => {
  return c.json(await llmConfigService.getWireRegistry());
});

llmConfigRoutes.get('/api/admin/llm/providers', requireAdmin, async (c) => {
  return c.json(await llmConfigService.listProviders());
});

llmConfigRoutes.post('/api/admin/llm/providers', requireAdmin, validateCreateProvider, async (c) => {
  const provider = await llmConfigService.createProvider(c.req.valid('json'));
  return c.json(provider, HTTP_STATUS.CREATED);
});

llmConfigRoutes.patch('/api/admin/llm/providers/:id', requireAdmin, validateUpdateProvider, async (c) => {
  const provider = await llmConfigService.updateProvider(c.req.param('id'), c.req.valid('json'));
  return c.json(provider);
});

llmConfigRoutes.delete('/api/admin/llm/providers/:id', requireAdmin, async (c) => {
  await llmConfigService.deleteProvider(c.req.param('id'));
  return c.body(null, HTTP_STATUS.NO_CONTENT);
});

llmConfigRoutes.post('/api/admin/llm/providers/:id/test', requireAdmin, validateTestProvider, async (c) => {
  const result = await llmConfigService.testProvider(c.req.param('id'), c.req.valid('json'));
  return c.json(result);
});

llmConfigRoutes.post('/api/admin/llm/providers/:id/fetch-models', requireAdmin, async (c) => {
  return c.json(await llmConfigService.fetchProviderModels(c.req.param('id')));
});

llmConfigRoutes.post('/api/admin/llm/providers/:id/balance', requireAdmin, async (c) => {
  return c.json(await llmConfigService.queryProviderBalance(c.req.param('id')));
});

llmConfigRoutes.get('/api/admin/llm/models', requireAdmin, validateModelListQuery, async (c) => {
  return c.json(await llmConfigService.listModels(c.req.valid('query')));
});

llmConfigRoutes.post('/api/admin/llm/models', requireAdmin, validateCreateModel, async (c) => {
  const model = await llmConfigService.createModel(c.req.valid('json'));
  return c.json(model, HTTP_STATUS.CREATED);
});

llmConfigRoutes.patch('/api/admin/llm/models/:id', requireAdmin, validateUpdateModel, async (c) => {
  const model = await llmConfigService.updateModel(c.req.param('id'), c.req.valid('json'));
  return c.json(model);
});

llmConfigRoutes.delete('/api/admin/llm/models/:id', requireAdmin, async (c) => {
  await llmConfigService.deleteModel(c.req.param('id'));
  return c.body(null, HTTP_STATUS.NO_CONTENT);
});

llmConfigRoutes.get('/api/admin/llm/settings', requireAdmin, async (c) => {
  return c.json(await llmConfigService.listSettings());
});

llmConfigRoutes.put('/api/admin/llm/settings/:key', requireAdmin, validatePutSetting, async (c) => {
  const setting = await llmConfigService.putSetting(c.req.param('key'), c.req.valid('json'));
  return c.json(setting);
});
