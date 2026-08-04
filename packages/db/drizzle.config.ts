import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/tables/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URI || 'postgresql://root:root@127.0.0.1:5433/app',
  },
});
