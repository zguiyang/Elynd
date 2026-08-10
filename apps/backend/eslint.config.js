import { ADONIS_IGNORE_LIST, configApp } from '@adonisjs/eslint-config';
import importX from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default configApp({
  name: 'Elynd shared import rules',
  files: ['**/*.ts'],
  ignores: ADONIS_IGNORE_LIST,
  plugins: {
    'simple-import-sort': simpleImportSort,
    'import-x': importX,
  },
  rules: {
    '@stylistic/max-len': ['error', { code: 120, comments: 120, ignoreUrls: true, ignoreTemplateLiterals: true }],
    'simple-import-sort/imports': [
      'error',
      {
        groups: [['^\\u0000'], ['^node:'], ['^@?\\w'], ['^@elynd/'], ['^#'], ['^\\.']],
      },
    ],
    'simple-import-sort/exports': 'error',
    'import-x/no-cycle': 'error',
    'import-x/order': 'off',
    'import/order': 'off',
    'sort-imports': 'off',
    // TS sources must not import via .js/.mjs/.cjs/.jsx (Node ESM rewrite habit).
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: '\\.(js|mjs|cjs|jsx)$',
            message: 'Do not use JavaScript extensions in TypeScript imports; use .ts/.tsx or omit the extension.',
          },
        ],
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      },
    ],
  },
});
