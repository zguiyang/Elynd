import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { ZodObject, ZodRawShape } from 'zod';
import { z } from 'zod';

const registry = new Map<string, { schema: ZodObject<ZodRawShape>; hash: string }>();
const cacheDir = path.join(process.cwd(), '.cache');
const cacheFile = path.join(cacheDir, 'zod-components.json');

function schemaToHash(schema: ZodObject<ZodRawShape>) {
  try {
    const json = (z as unknown as { toJSONSchema: (s: unknown, o: object) => unknown }).toJSONSchema(schema, {
      io: 'input',
    });
    const str = JSON.stringify(json);
    return crypto.createHash('sha1').update(str).digest('hex');
  } catch {
    const fallback = (schema as { name?: string }).name ?? JSON.stringify(schema);
    return crypto.createHash('sha1').update(String(fallback)).digest('hex');
  }
}

function ensureCacheDir() {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
  } catch {
    // ignore
  }
}

export function registerSchema(schema: ZodObject<ZodRawShape>, hintName?: string) {
  for (const [name, entry] of registry.entries()) {
    if (entry.schema === schema) return name;
  }

  const metaId =
    (schema as { _def?: { meta?: { id?: string }; description?: string } })._def?.meta?.id ??
    (schema as { _def?: { description?: string } })._def?.description ??
    undefined;

  const hash = schemaToHash(schema);
  const nameFromHash = `Zod_${hash.slice(0, 8)}`;
  const name = hintName ?? metaId ?? nameFromHash;

  registry.set(name, { schema, hash });
  return name;
}

export function getRegisteredName(schema: ZodObject<ZodRawShape>) {
  for (const [name, entry] of registry.entries()) {
    if (entry.schema === schema) return name;
  }
  return undefined;
}

export function createComponents() {
  ensureCacheDir();

  let cache: {
    version: number;
    entries: Record<string, { hash: string; component: unknown }>;
  } | null = null;

  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf8');
      cache = JSON.parse(raw);
    }
  } catch {
    cache = null;
  }

  const out: Record<string, unknown> = {};
  let updated = false;

  for (const [name, entry] of registry.entries()) {
    const { schema, hash } = entry;

    if (cache?.entries?.[name] && cache.entries[name].hash === hash) {
      out[name] = cache.entries[name].component;
      continue;
    }

    try {
      const json = (
        z as unknown as {
          toJSONSchema: (
            s: unknown,
            o: object,
          ) => {
            definitions?: Record<string, unknown>;
            $ref?: string;
            $schema?: string;
          };
        }
      ).toJSONSchema(schema, { name, io: 'input' });

      let component: unknown = null;
      if (json?.definitions?.[name]) {
        component = json.definitions[name];
      } else if (json?.$ref && json.definitions) {
        const ref = (json.$ref as string).replace('#/definitions/', '');
        component = json.definitions[ref] ?? json;
      } else {
        const copy = { ...json };
        delete copy.$schema;
        component = copy;
      }

      out[name] = component;

      if (!cache) cache = { version: 1, entries: {} };
      cache.entries[name] = { hash, component };
      updated = true;
    } catch (err) {
      out[name] = {
        type: 'object',
        description: `Failed to convert schema: ${(err as Error).message}`,
      };
    }
  }

  if (updated && cache) {
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    } catch {
      // ignore cache write errors
    }
  }

  return { schemas: out };
}

export function clearRegistry() {
  registry.clear();
}

export function debugGetRegistryEntries() {
  const map: Record<string, { hash: string }> = {};
  for (const [name, entry] of registry.entries()) {
    map[name] = { hash: entry.hash };
  }
  return map;
}
