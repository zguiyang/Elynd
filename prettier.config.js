import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Resolve Edge plugin via @adonisjs/prettier-config (kept as backend special). */
function resolveEdgePlugin() {
  try {
    const adonisPrettier = require('@adonisjs/prettier-config');
    const plugins = adonisPrettier.plugins ?? [];
    if (plugins.length > 0) {
      return plugins;
    }
  } catch {
    // Fall through — plugin may be unavailable outside backend install.
  }
  try {
    return [require.resolve('prettier-edge')];
  } catch {
    return [];
  }
}

/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  printWidth: 120,
  tabWidth: 2,
  endOfLine: 'lf',
  arrowParens: 'always',
  overrides: [
    {
      files: ['apps/backend/**/*.edge'],
      options: {
        plugins: resolveEdgePlugin(),
      },
    },
  ],
};

export default config;
