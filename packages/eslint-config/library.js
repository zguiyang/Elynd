import globals from 'globals'

import { baseConfigs } from './base.js'

/** Workspace library packages (`@elynd/db`, `@elynd/shared`). */
export default [
  ...baseConfigs,
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.tsbuildinfo']
  }
]
