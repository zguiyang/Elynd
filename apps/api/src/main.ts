/**
 * Env must be loaded before AppModule pulls in `@elynd/auth/server` (eager `auth`).
 * Keep this import first.
 */
import './load-env.js';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { parseTrustedOrigins } from '@elynd/auth/env';

import { AppModule } from './app.module.js';
import { resolveCorsOrigin } from './config/cors-origin.js';
import { createComponents } from './swagger/zod-schema-registry.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // bodyParser: false — required by @thallesp/nestjs-better-auth (library re-adds parsers for non-auth routes)
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'api-doc', 'api-doc/(.*)'],
  });

  const trustedOriginsRaw = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.trim() ?? '';
  if (!trustedOriginsRaw) {
    throw new Error('BETTER_AUTH_TRUSTED_ORIGINS must be set to configure CORS allowlist');
  }

  app.enableCors({
    origin: resolveCorsOrigin(parseTrustedOrigins(trustedOriginsRaw)),
    credentials: true,
  });

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

  SwaggerModule.setup(
    'api-doc',
    app,
    cleanupOpenApiDoc(openApiDoc, {
      version: '3.0',
    }),
    {
      jsonDocumentUrl: '/api-doc/json',
    },
  );

  const port = process.env.PORT ?? 3336;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
