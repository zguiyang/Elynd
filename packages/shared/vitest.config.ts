import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts']
  },
  resolve: {
    alias: {
      '@elynd/db': resolve(__dirname, '../db/src/index.ts')
    }
  }
})
