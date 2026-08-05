import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { AppController } from './app.controller.js';
import { applyApiGlobalPrefix, createOpenApiDocument } from './openapi-document.js';

vi.mock('@elynd/auth/server', () => ({
  auth: {
    api: {
      generateOpenAPISchema: vi.fn(async () => ({
        openapi: '3.1.0',
        info: { title: 'Better Auth', version: '1.0.0' },
        paths: {
          '/sign-in/email': {
            post: {
              tags: ['Default'],
              operationId: 'signInEmail',
              summary: 'Sign in with email and password',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
        components: { schemas: {} },
        tags: [{ name: 'Default', description: 'Core Better Auth endpoints' }],
      })),
    },
  },
}));

describe('createOpenApiDocument', () => {
  it('includes Nest health and Better Auth paths under /api/auth', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const app = moduleRef.createNestApplication();
    applyApiGlobalPrefix(app);
    await app.init();

    try {
      const doc = await createOpenApiDocument(app);
      expect(doc.paths?.['/health']?.get).toBeDefined();
      expect(doc.paths?.['/api/health']).toBeUndefined();
      expect(doc.paths?.['/health']?.get?.responses?.['200']).toBeDefined();
      expect(doc.components?.schemas?.HealthResponseDto).toBeDefined();
      expect(doc.paths?.['/api/auth/sign-in/email']?.post).toBeDefined();
      expect(doc.tags?.some((tag) => tag.name === 'System')).toBe(true);
      expect(doc.paths?.['/api/auth/sign-in/email']?.post?.tags).toContain('Authentication');
      expect(doc.tags?.some((tag) => tag.name === 'Default')).toBe(false);
    } finally {
      await app.close();
    }
  });
});
