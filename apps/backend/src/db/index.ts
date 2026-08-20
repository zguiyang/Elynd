import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@gloaming/db/schema';

import { env } from '@/lib/env';
import { dbLogger } from '@/lib/logger';

dbLogger.info('Connecting to PostgreSQL...');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

dbLogger.info('Connected to PostgreSQL');
