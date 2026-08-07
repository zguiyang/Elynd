import app from '@adonisjs/core/services/app';
import { defineConfig } from '@adonisjs/lucid';

import env from '#start/env';

const dbConfig = defineConfig({
  /**
   * Default connection — Compose Postgres (host port 5433).
   */
  connection: 'postgres',

  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      schemaGeneration: {
        enabled: true,
        rulesPaths: ['./database/schema_rules.js'],
      },
      debug: app.inDev,
    },
  },
});

export default dbConfig;
