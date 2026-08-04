import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const nodePackageFiles = [
  'apps/api/**/*.{js,mjs,ts}',
  'packages/db/**/*.{js,mjs,ts}',
  'packages/shared/**/*.{js,mjs,ts}'
]

const nextFiles = ['apps/web/**/*.{js,jsx,mjs,ts,tsx}']

/** Scope Next flat configs to apps/web only (they default to repo-wide globs). */
function scopeToWeb(configs) {
  return configs.map((config) => ({
    ...config,
    files: nextFiles
  }))
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
    '.pnpm-store/**'
  ]),

  {
    files: nodePackageFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  ...scopeToWeb(nextVitals),
  ...scopeToWeb(nextTs),
  {
    files: nextFiles,
    settings: {
      next: {
        rootDir: 'apps/web'
      }
    }
  },
  {
    files: nextFiles,
    ...eslintConfigPrettier
  }
])
