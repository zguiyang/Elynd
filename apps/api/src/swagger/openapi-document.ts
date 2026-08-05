import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { createComponents } from './zod-schema-registry.js';

/** Paths excluded from the `api` global prefix (must match bootstrap + OpenAPI gen). */
export const API_GLOBAL_PREFIX_EXCLUDE = ['health'] as const;

export function applyApiGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: [...API_GLOBAL_PREFIX_EXCLUDE],
  });
}

/**
 * Build the OpenAPI document from the Nest app (no UI).
 * Used by bootstrap (optional) and `openapi:gen`.
 */
export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Elynd API')
    .setDescription('Elynd Nest API documentation')
    .setVersion('1.0')
    .addTag('elynd')
    .build();

  const openApiDoc = SwaggerModule.createDocument(app, config, {});

  try {
    const zodComponents = createComponents();
    openApiDoc.components = {
      ...(openApiDoc.components || {}),
      schemas: {
        ...((openApiDoc.components && openApiDoc.components.schemas) || {}),
        ...(zodComponents.schemas as Record<string, object>),
      },
    };
  } catch (err) {
    console.warn('Failed to create Zod OpenAPI components:', (err as Error).message);
  }

  return cleanupOpenApiDoc(openApiDoc, {
    version: '3.0',
  });
}
