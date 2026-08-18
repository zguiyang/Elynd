import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

import type { ObjectGetResult, ObjectPutInput, ObjectStore } from '@/lib/oss/types';

export type R2ObjectStoreConfig = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Injected for tests — production builds a real S3Client. */
  client?: Pick<S3Client, 'send'>;
};

async function streamBodyToBuffer(body: unknown): Promise<Buffer> {
  if (body == null) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body) {
    const transform = (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray;
    if (typeof transform === 'function') {
      return Buffer.from(await transform.call(body));
    }
  }
  throw new Error('Unsupported R2 object body type');
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  if (record.name === 'NotFound' || record.name === 'NoSuchKey') {
    return true;
  }
  return record.$metadata?.httpStatusCode === 404;
}

/**
 * Low-level R2 adapter via the S3-compatible API. Credentials are passed explicitly.
 */
export function createR2ObjectStore(config: R2ObjectStoreConfig): ObjectStore {
  const clientConfig: S3ClientConfig = {
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };
  const client = config.client ?? new S3Client(clientConfig);
  const bucket = config.bucket;

  return {
    async put(input: ObjectPutInput): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          Metadata: input.metadata,
        }),
      );
    },

    async get(key: string): Promise<ObjectGetResult | null> {
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        return {
          body: await streamBodyToBuffer(response.Body),
          contentType: response.ContentType?.trim() || 'application/octet-stream',
        };
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },

    async exists(key: string): Promise<boolean> {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
          }),
        );
        return true;
      } catch (error) {
        if (isNotFoundError(error)) {
          return false;
        }
        throw error;
      }
    },

    async delete(key: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    },
  };
}
