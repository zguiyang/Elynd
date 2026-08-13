import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const envFilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');

/** Empty string in `.env` → treat as unset. */
const emptyToUndefined = (value: unknown) => (value === '' || value === undefined ? undefined : value);

const envSchema = z.object({
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
});

export type Env = z.infer<typeof envSchema>;

/**
 * Load `apps/backend/.env` (overrides ambient shell exports), then Zod-parse.
 * Throws on invalid/missing required vars so the process fails at boot.
 */
function getEnvConfig(processEnv: NodeJS.ProcessEnv = process.env): Env {
  loadDotenv({ path: envFilePath, override: true });
  return envSchema.parse(processEnv);
}

export const env = getEnvConfig();
