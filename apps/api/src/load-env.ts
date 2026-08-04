import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load apps/api `.env` into `process.env` before any import of `@elynd/auth/server`.
 * Must be the first import in `main.ts` (ESM evaluates imports in order).
 *
 * Uses Node's built-in `process.loadEnvFile` (Node 20.12+ / 24).
 */
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
