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

const nodePackageFiles = ['packages/shared/**/*.{js,mjs,ts}'];

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
    'apps/backend/**',
    '.trellis/**',
    '.pnpm-store/**',
    '**/vitest.config.ts',
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
        { type: 'backend', pattern: 'apps/backend/**' },
        { type: 'shared', pattern: 'packages/shared/**' },
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
      // TS sources must not import via .js/.mjs/.cjs/.jsx (Node ESM rewrite habit).
      // Prefer extensionless or explicit .ts/.tsx (see packages/shared).
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
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'web' } },
              disallow: { to: { element: { type: 'backend' } } },
            },
            {
              from: { element: { type: 'backend' } },
              disallow: { to: { element: { type: 'web' } } },
            },
            {
              from: { element: { type: 'shared' } },
              disallow: { to: { element: { types: { anyOf: ['web', 'backend'] } } } },
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
    },
  },
  {
    files: nextFiles,
    ...eslintConfigPrettier,
  },
]);
