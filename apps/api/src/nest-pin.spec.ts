import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

describe('NEST-001 Nest pin', () => {
  it('resolves @nestjs/core to 11.x (not Nest 12)', () => {
    const pkgPath = require.resolve('@nestjs/core/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

    expect(pkg.version.startsWith('11.')).toBe(true);
    expect(pkg.version.startsWith('12.')).toBe(false);

    const apiPkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    expect(apiPkg.dependencies['@nestjs/core']).toMatch(/\^?11\./);
  });
});
