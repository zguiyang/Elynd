import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as tables from './tables/index.js';

export type Db = NodePgDatabase<typeof tables>;

let pool: Pool | null = null;
let db: Db | null = null;

export function setupDb(connectionString: string): Db {
  if (db && pool) {
    return db;
  }

  pool = new Pool({
    connectionString,
    ssl: false,
  });

  db = drizzle({ client: pool, schema: tables });
  return db;
}

export function closeDb(): void {
  if (pool) {
    void pool.end().finally(() => {
      pool = null;
      db = null;
    });
  }
}

export * from './tables/index.js';
