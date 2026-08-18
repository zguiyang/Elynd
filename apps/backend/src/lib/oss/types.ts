export type ObjectPutInput = {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
};

export type ObjectGetResult = {
  body: Buffer;
  contentType: string;
};

/**
 * Provider-facing object store. Implementations must not read env or DB.
 * Multi-tier strategies (cache + R2) can wrap this later without changing callers.
 */
export type ObjectStore = {
  put(input: ObjectPutInput): Promise<void>;
  get(key: string): Promise<ObjectGetResult | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
};
