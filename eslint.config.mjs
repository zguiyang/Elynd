import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodePackageFiles = [
  'apps/api/**/*.{js,mjs,ts}',
  'packages/auth/**/*.{js,mjs,ts}',
  'packages/db/**/*.{js,mjs,ts}',
  'packages/shared/**/*.{js,mjs,ts}',
];

const nextFiles = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}'];

const allSourceFiles = [...nodePackageFiles, ...nextFiles];

const namingConventionBase = [
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },
  {
    selector: 'variable',
    filter: {
      regex: '^__',
      match: true,
    },
    format: null,
  },
  { selector: 'typeLike', format: ['PascalCase'] },
  {
    selector: 'function',
    format: ['camelCase', 'PascalCase'],
    leadingUnderscore: 'allow',
  },
  {
    selector: 'variable',
    format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
  },
  { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  { selector: 'objectLiteralProperty', format: null },
  {
    selector: 'typeProperty',
    format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
  },
];

/** Scope Next flat configs to apps/web only (they default to repo-wide globs). */
function scopeToWeb(configs) {
  return configs.map((config) => ({
    ...config,
    files: nextFiles,
  }));
}

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/*.tsbuildinfo',
    'apps/web/next-env.d.ts',
    '.trellis/**',
    '.pnpm-store/**',
    '**/vitest.config.ts',
    '**/drizzle.config.ts',
    '**/postcss.config.mjs',
  ]),

  {
    files: allSourceFiles,
    plugins: {
      'simple-import-sort': simpleImportSort,
      'import-x': importX,
      boundaries,
      '@typescript-eslint': tseslint.plugin,
    },
    settings: {
      'boundaries/elements': [
        { type: 'web', pattern: 'apps/web/**' },
        { type: 'api', pattern: 'apps/api/**' },
        { type: 'shared', pattern: 'packages/shared/**' },
        { type: 'db', pattern: 'packages/db/**' },
        { type: 'auth', pattern: 'packages/auth/**' },
        { type: 'api-feature', pattern: 'apps/api/src/api/*' },
        { type: 'api-common', pattern: 'apps/api/src/common/**' },
      ],
    },
    rules: {
      'simple-import-sort/imports': [
        'error',
        {
          groups: [['^\\u0000'], ['^node:'], ['^@?\\w'], ['^@elynd/'], ['^@/'], ['^\\.']],
        },
      ],
      'simple-import-sort/exports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-unused-modules': 'warn',
      'import-x/order': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'web' } },
              disallow: { to: { element: { types: { anyOf: ['api', 'db'] } } } },
            },
            {
              from: { element: { type: 'api' } },
              disallow: { to: { element: { type: 'web' } } },
            },
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: { anyOf: ['web', 'api', 'db', 'auth'] } } } },
            },
            {
              from: { element: { type: 'db' } },
              disallow: { to: { element: { types: { anyOf: ['web', 'api', 'shared', 'auth'] } } } },
            },
            {
              from: { element: { type: 'auth' } },
              disallow: { to: { element: { types: { anyOf: ['web', 'api', 'shared'] } } } },
            },
            {
              from: { element: { type: 'api-common' } },
              disallow: { to: { element: { type: 'api-feature' } } },
            },
          ],
        },
      ],
      '@typescript-eslint/naming-convention': ['error', ...namingConventionBase],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },

  {
    files: nodePackageFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  ...scopeToWeb(nextVitals),
  ...scopeToWeb(nextTs),
  {
    files: nextFiles,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      next: {
        rootDir: 'apps/web',
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        ...namingConventionBase,
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['camelCase', 'PascalCase'],
          prefix: ['is', 'has', 'can', 'should', 'enable'],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@elynd/auth/server',
              message: 'Web must use @elynd/auth/client. Type-only imports from server are allowed.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: nextFiles,
    ...eslintConfigPrettier,
  },
]);
