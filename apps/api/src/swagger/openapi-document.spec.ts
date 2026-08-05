import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppController } from '../app.controller.js';
import { applyApiGlobalPrefix, createOpenApiDocument } from './openapi-document.js';

describe('createOpenApiDocument', () => {
  it('includes GET /health outside the api global prefix', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const app = moduleRef.createNestApplication();
    applyApiGlobalPrefix(app);
    await app.init();

    try {
      const doc = createOpenApiDocument(app);
      expect(doc.paths?.['/health']?.get).toBeDefined();
      expect(doc.paths?.['/api/health']).toBeUndefined();
      expect(doc.paths?.['/health']?.get?.responses?.['200']).toBeDefined();
      expect(doc.components?.schemas?.HealthResponseDto).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
