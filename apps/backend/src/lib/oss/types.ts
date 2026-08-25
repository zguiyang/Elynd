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

/** Optional byte range for streamed reads (end is inclusive). */
export type ObjectRange = {
  start: number;
  end?: number;
};

export type ObjectGetStreamResult = {
  /** Web ReadableStream — safe to pass directly to a Response body. */
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  /** Total object length (when no range) or served length — null when unknown. */
  contentLength: number | null;
  /** `bytes start-end/total` when a range was applied — null otherwise. */
  contentRange: string | null;
  etag: string | null;
};

/**
 * Provider-facing object store. Implementations must not read env or DB.
 * Multi-tier strategies (cache + R2) can wrap this later without changing callers.
 */
export type ObjectStore = {
  put(input: ObjectPutInput): Promise<void>;
  get(key: string): Promise<ObjectGetResult | null>;
  /** Streamed read with optional byte range (used by the asset gateway). */
  getStream(key: string, range?: ObjectRange): Promise<ObjectGetStreamResult | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
};
