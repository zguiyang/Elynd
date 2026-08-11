import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

const root = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(root, '../../apps/backend/.env') });

function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = process.env.DB_PORT ?? '5433';
  const user = process.env.DB_USER ?? 'root';
  const password = process.env.DB_PASSWORD ?? 'root';
  const database = process.env.DB_DATABASE ?? 'elynd_backend';
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl(),
  },
});
