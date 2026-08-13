import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'prompts');
const dest = join(root, 'dist', 'prompts');

if (!existsSync(src)) {
  console.error(`copy-prompts: missing ${src}`);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`copy-prompts: ${src} → ${dest}`);
