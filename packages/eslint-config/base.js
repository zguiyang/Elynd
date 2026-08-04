import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/** Shared TypeScript baseline (no framework). */
export const baseConfigs = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module'
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)

export default baseConfigs
