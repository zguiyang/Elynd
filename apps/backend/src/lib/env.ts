import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const envFilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
const testEnvFilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env.test');

const TEST_DATABASE_NAME = 'gloaming_test';

function databaseNameFromUrl(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '').split('/')[0];
  if (!name) {
    throw new Error(`Cannot parse database name from DATABASE_URL: ${url}`);
  }
  return decodeURIComponent(name);
}

/** Vitest only — require TEST_DATABASE_URL; never fall back to development DATABASE_URL. */
function applyTestDatabaseEnv(processEnv: NodeJS.ProcessEnv): void {
  if (processEnv.VITEST !== 'true') {
    return;
  }

  loadDotenv({ path: testEnvFilePath, override: true });

  const testUrl = processEnv.TEST_DATABASE_URL?.trim();
  if (!testUrl) {
    delete processEnv.DATABASE_URL;
    throw new Error(
      [
        'TEST_DATABASE_URL is required for backend tests.',
        'Copy apps/backend/.env.test.example → apps/backend/.env.test, create database gloaming_test, then run: pnpm db:migrate:test',
      ].join(' '),
    );
  }

  const dbName = databaseNameFromUrl(testUrl);
  if (dbName !== TEST_DATABASE_NAME) {
    delete processEnv.DATABASE_URL;
    throw new Error(
      `TEST_DATABASE_URL must point exactly at the test database "${TEST_DATABASE_NAME}", got "${dbName}".`,
    );
  }

  processEnv.DATABASE_URL = testUrl;
}

/** Empty string in `.env` → treat as unset. */
const emptyToUndefined = (value: unknown) => (value === '' || value === undefined ? undefined : value);

const optionalNonEmpty = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    HOST: z.string().min(1).default('localhost'),
    LOG_LEVEL: z.string().min(1).default('info'),

    FRONTEND_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(16),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    MAIL_FROM_ADDRESS: z.string().email(),
    MAIL_FROM_NAME: z.string().min(1),

    /**
     * 32-byte key material as base64 or 64-char hex — used to encrypt LLM API keys at rest.
     * Generate: `openssl rand -base64 32`
     */
    LLM_CONFIG_ENCRYPTION_KEY: z.string().min(1),

    /** Object storage driver — only `r2` is implemented today. */
    OSS_DRIVER: z.enum(['r2']).default('r2'),
    R2_ACCOUNT_ID: optionalNonEmpty,
    R2_BUCKET: optionalNonEmpty,
    R2_ACCESS_KEY_ID: optionalNonEmpty,
    R2_SECRET_ACCESS_KEY: optionalNonEmpty,
  })
  .superRefine((data, ctx) => {
    const r2Fields = [data.R2_ACCOUNT_ID, data.R2_BUCKET, data.R2_ACCESS_KEY_ID, data.R2_SECRET_ACCESS_KEY];
    const setCount = r2Fields.filter(Boolean).length;
    if (setCount > 0 && setCount < 4) {
      ctx.addIssue({
        code: 'custom',
        message:
          'R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set together (or all omitted)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Load `apps/backend/.env` (overrides ambient shell exports), then Zod-parse.
 * Throws on invalid/missing required vars so the process fails at boot.
 */
function getEnvConfig(processEnv: NodeJS.ProcessEnv = process.env): Env {
  loadDotenv({ path: envFilePath, override: true });
  applyTestDatabaseEnv(processEnv);
  return envSchema.parse(processEnv);
}

export const env = getEnvConfig();

export function isR2ObjectStorageConfigured(config: Env = env): boolean {
  return Boolean(config.R2_ACCOUNT_ID && config.R2_BUCKET && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY);
}
