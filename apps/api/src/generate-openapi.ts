/**
 * Offline OpenAPI generator for Apifox import.
 * Env must load before AppModule pulls in `@elynd/auth/server`.
 */
import './load-env.js';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { applyApiGlobalPrefix, createOpenApiDocument } from './swagger/openapi-document.js';

async function generateOpenApi() {
  const logger = new Logger('OpenApiGen');

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn'],
  });

  applyApiGlobalPrefix(app);
  await app.init();

  const document = createOpenApiDocument(app);
  const outFile = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi/openapi.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  logger.log(`Wrote OpenAPI document to ${outFile}`);
  await app.close();
}

void generateOpenApi().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
