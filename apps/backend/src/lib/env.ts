import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('localhost'),
  LOG_LEVEL: z.string().default('info'),
  /** May be a literal Adonis-style template; normalized below. */
  APP_URL: z.string().min(1).optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().optional(),
  APP_KEY: z.string().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(5433),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_DATABASE: z.string().default('elynd_backend'),
  REDIS_URL: z.string().min(1).optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6380),
  REDIS_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().default('noreply@example.com'),
  MAIL_FROM_NAME: z.string().default('Elynd'),
});

export type Env = z.infer<typeof envSchema> & {
  APP_URL: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  DATABASE_URL: string;
  REDIS_URL: string;
};

function looksLikeUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function buildAppUrl(data: z.infer<typeof envSchema>): string {
  if (data.APP_URL && looksLikeUrl(data.APP_URL)) {
    return data.APP_URL;
  }
  const host = data.HOST === '0.0.0.0' ? 'localhost' : data.HOST;
  return `http://${host}:${data.PORT}`;
}

function buildDatabaseUrl(data: z.infer<typeof envSchema>): string {
  if (data.DATABASE_URL) {
    return data.DATABASE_URL;
  }
  const password = data.DB_PASSWORD ? `:${encodeURIComponent(data.DB_PASSWORD)}` : '';
  return `postgresql://${data.DB_USER}${password}@${data.DB_HOST}:${data.DB_PORT}/${data.DB_DATABASE}`;
}

function buildRedisUrl(data: z.infer<typeof envSchema>): string {
  if (data.REDIS_URL) {
    return data.REDIS_URL;
  }
  const password = data.REDIS_PASSWORD ? `:${encodeURIComponent(data.REDIS_PASSWORD)}@` : '';
  return `redis://${password}${data.REDIS_HOST}:${data.REDIS_PORT}`;
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const raw = parsed.data;
const appUrl = buildAppUrl(raw);
const betterAuthSecret = raw.BETTER_AUTH_SECRET || raw.APP_KEY;
if (!betterAuthSecret || betterAuthSecret.length < 16) {
  console.error('Invalid environment variables:', {
    BETTER_AUTH_SECRET: ['Required (or APP_KEY ≥ 16 chars)'],
  });
  throw new Error('Invalid environment variables');
}

export const env = {
  ...raw,
  APP_URL: appUrl,
  BETTER_AUTH_URL: raw.BETTER_AUTH_URL && looksLikeUrl(raw.BETTER_AUTH_URL) ? raw.BETTER_AUTH_URL : appUrl,
  BETTER_AUTH_SECRET: betterAuthSecret,
  DATABASE_URL: buildDatabaseUrl(raw),
  REDIS_URL: buildRedisUrl(raw),
};
