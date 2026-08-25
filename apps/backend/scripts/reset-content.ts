/**
 * Dev-only content reset: wipes all content rows (works, parts, states, assets,
 * conversations, uploads, reading days), content-derived Redis caches
 * (TTS audio, bilingual translation), the BullMQ job queue, and object-storage
 * files (R2).
 *
 * Keeps: users/sessions/accounts, LLM config, TTS config.
 * Run: pnpm --filter @gloaming/backend reset:content
 */
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import Redis from 'ioredis';

import {
  contentAsset as contentAssetTable,
  conversation as conversationTable,
  conversationMessage as conversationMessageTable,
  readingDay as readingDayTable,
  readingPart as readingPartTable,
  readingState as readingStateTable,
  readingWork as readingWorkTable,
  uploadedObject as uploadedObjectTable,
} from '@gloaming/db';

import { db } from '../src/db/index.ts';
import { env } from '../src/lib/env.ts';

const CACHE_PATTERNS = ['gloaming:tts:v1:*', 'gloaming:bilingual:v2:*'] as const;

async function deleteAll(table: Parameters<typeof db.delete>[0], label: string): Promise<number> {
  const rows = await db.delete(table).returning({ id: table.id });
  console.log(`Deleted ${rows.length} ${label}`);
  return rows.length;
}

async function flushCachePatterns(redis: Redis): Promise<number> {
  let total = 0;
  for (const pattern of CACHE_PATTERNS) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        total += keys.length;
      }
    } while (cursor !== '0');
  }
  console.log(`Deleted ${total} Redis cache keys`);
  return total;
}

/** Wipe the BullMQ queue so stale jobs (old products, deleted works) never run again. */
async function flushJobQueue(redis: Redis): Promise<void> {
  let cursor = '0';
  let total = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'bull:gloaming:*', 'COUNT', 500);
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
      total += keys.length;
    }
  } while (cursor !== '0');
  console.log(`Deleted ${total} BullMQ queue keys`);
}

/** Wipe every object in R2 (dev bucket — all content is throwaway). */
async function flushObjectStorage(): Promise<void> {
  if (env.OSS_DRIVER !== 'r2' || !env.R2_ACCOUNT_ID || !env.R2_BUCKET) {
    console.log('R2 not configured — skipping object storage flush');
    return;
  }
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  let total = 0;
  let token: string | undefined;
  do {
    const result = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, ContinuationToken: token }));
    for (const object of result.Contents ?? []) {
      await s3.send(
        new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
          Bucket: env.R2_BUCKET,
          Key: object.Key,
        }),
      );
      total += 1;
    }
    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);
  console.log(`Deleted ${total} R2 objects`);
}

async function main() {
  await deleteAll(conversationMessageTable, 'conversation messages');
  await deleteAll(conversationTable, 'conversations');
  await deleteAll(contentAssetTable, 'content assets');
  await deleteAll(readingStateTable, 'reading states');
  await deleteAll(readingPartTable, 'reading parts');
  await deleteAll(uploadedObjectTable, 'uploaded objects');
  await deleteAll(readingDayTable, 'reading days');
  await deleteAll(readingWorkTable, 'reading works');

  const redis = new Redis(env.REDIS_URL);
  try {
    await flushCachePatterns(redis);
    await flushJobQueue(redis);
  } finally {
    redis.disconnect();
  }
  await flushObjectStorage();
  console.log('Content reset complete.');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Content reset failed:', error);
  process.exit(1);
});
