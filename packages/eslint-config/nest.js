import globals from 'globals'

import { baseConfigs } from './base.js'

/** NestJS / Node API apps. */
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
