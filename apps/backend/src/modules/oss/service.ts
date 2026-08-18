import { HTTP_STATUS } from '@/constants';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { rootLogger } from '@/lib/logger';
import { createObjectStoreFromEnv, type ObjectGetResult, type ObjectPutInput, type ObjectStore } from '@/lib/oss';

const ossLogger = rootLogger.child({ module: 'Oss' });

let cachedStore: ObjectStore | null | undefined;

function resolveStore(): ObjectStore {
  if (cachedStore !== undefined) {
    if (!cachedStore) {
      throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Object storage is not configured');
    }
    return cachedStore;
  }

  try {
    cachedStore = createObjectStoreFromEnv(env);
  } catch (error) {
    ossLogger.error({ err: error }, 'Failed to create object store');
    throw new AppError(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      error instanceof Error ? error.message : 'Object storage is unavailable',
    );
  }

  if (!cachedStore) {
    throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Object storage is not configured');
  }
  return cachedStore;
}

/** Test seam — clears the cached ObjectStore instance. */
export function resetObjectStoreCache(): void {
  cachedStore = undefined;
}

/** Test seam — inject a store (e.g. in-memory) without R2 credentials. */
export function setObjectStoreForTests(store: ObjectStore | null): void {
  cachedStore = store;
}

export async function putObject(input: ObjectPutInput): Promise<void> {
  await resolveStore().put(input);
}

export async function getObject(key: string): Promise<ObjectGetResult | null> {
  return resolveStore().get(key);
}

export async function objectExists(key: string): Promise<boolean> {
  return resolveStore().exists(key);
}

export async function deleteObject(key: string): Promise<void> {
  await resolveStore().delete(key);
}
