/**
 * Env must be loaded before AppModule pulls in `@elynd/auth/server` (eager `auth`).
 * Keep this import first.
 */
import './load-env.js';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { parseTrustedOrigins } from '@elynd/auth/env';

import { AppModule } from './app.module.js';
import { resolveCorsOrigin } from './cors-origin.js';
import { applyApiGlobalPrefix } from './openapi-document.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // bodyParser: false — required by @thallesp/nestjs-better-auth (library re-adds parsers for non-auth routes)
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  applyApiGlobalPrefix(app);

  const trustedOriginsRaw = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.trim() ?? '';
  if (!trustedOriginsRaw) {
    throw new Error('BETTER_AUTH_TRUSTED_ORIGINS must be set to configure CORS allowlist');
  }

  app.enableCors({
    origin: resolveCorsOrigin(parseTrustedOrigins(trustedOriginsRaw)),
    credentials: true,
  });

  const port = process.env.PORT ?? 3336;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
