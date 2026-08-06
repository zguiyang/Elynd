import { resolve } from 'path';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    env: {
      NODE_ENV: 'test',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      '@elynd/auth/policy': resolve(__dirname, '../../packages/auth/src/policy.ts'),
      '@elynd/db': resolve(__dirname, '../../packages/db/src/index.ts'),
      '@elynd/shared/schemas': resolve(__dirname, '../../packages/shared/src/schemas/index.ts'),
      '@elynd/shared/types': resolve(__dirname, '../../packages/shared/src/types/index.ts'),
      '@elynd/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
