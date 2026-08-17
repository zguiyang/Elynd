import { Hono } from 'hono';

import { type AuthVariables, requireAdmin } from '@/middleware/auth';
import * as ttsService from '@/modules/tts/service';
import { validatePutTtsConfig, validateTestTts } from '@/modules/tts/validator';

export const ttsRoutes = new Hono<{ Variables: AuthVariables }>();

ttsRoutes.get('/api/admin/tts/config', requireAdmin, async (c) => {
  return c.json(await ttsService.getConfig());
});

ttsRoutes.put('/api/admin/tts/config', requireAdmin, validatePutTtsConfig, async (c) => {
  return c.json(await ttsService.putConfig(c.req.valid('json')));
});

ttsRoutes.get('/api/admin/tts/voice-presets', requireAdmin, async (c) => {
  return c.json(ttsService.listVoicePresets());
});

ttsRoutes.post('/api/admin/tts/test', requireAdmin, validateTestTts, async (c) => {
  return c.json(await ttsService.testTts(c.req.valid('json')));
});
