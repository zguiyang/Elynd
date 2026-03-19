import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    name: 'app/type-import-rules',
    files: ['**/*.{ts,mts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
    },
  },
]
