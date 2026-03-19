import { configApp } from '@adonisjs/eslint-config'
import pluginImport from 'eslint-plugin-import'

export default [
  ...configApp(),
  {
    name: 'app/type-import-rules',
    files: ['**/*.{ts,mts,tsx}'],
    plugins: {
      import: pluginImport,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      'import/no-duplicates': 'error',
    },
  },
]
