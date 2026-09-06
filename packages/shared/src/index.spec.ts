import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import * as shared from './index.ts';

describe('shared root facade', () => {
  it('keeps the package root as the only entrypoint and uses explicit exports', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports: Record<string, string>;
    };
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(packageJson.exports).toEqual({ '.': './src/index.ts' });
    expect(indexSource).not.toMatch(/export\s+\*/);
  });

  it('exposes work contracts but not backend workflow switches', () => {
    expect(shared.workSchema).toBeDefined();
    expect(shared.adminWorkflowPolicySchema).toBeDefined();
    expect(shared).not.toHaveProperty('WORKFLOW_AUTO_CHAIN');
    expect(shared).not.toHaveProperty('TTS_STEP_ENABLED');
  });
});
