import type { ObjectStore } from '@/lib/oss';

/** In-memory ObjectStore for functional tests. */
export function createMemoryObjectStore(): ObjectStore & { store: Map<string, { body: Buffer; contentType: string }> } {
  const store = new Map<string, { body: Buffer; contentType: string }>();
  return {
    store,
    async put(input) {
      store.set(input.key, { body: Buffer.from(input.body), contentType: input.contentType });
    },
    async get(key) {
      const value = store.get(key);
      if (!value) {
        return null;
      }
      return { body: Buffer.from(value.body), contentType: value.contentType };
    },
    async exists(key) {
      return store.has(key);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
