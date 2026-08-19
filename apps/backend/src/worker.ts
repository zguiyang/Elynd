import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import type { PingJobData } from '@/jobs/ping';
import { JOB_PING, processPing } from '@/jobs/ping';
import type { ReviewMaterializeJobData } from '@/jobs/review-materialize';
import {
  JOB_REVIEW_MATERIALIZE,
  processReviewMaterialize,
  REVIEW_MATERIALIZE_CRON,
  REVIEW_MATERIALIZE_SCHEDULER_ID,
  REVIEW_MATERIALIZE_TZ,
} from '@/jobs/review-materialize';
import { workerLogger } from '@/lib/logger';
import { closeQueue, getQueue, getQueueConnection, QUEUE_NAME } from '@/lib/queue';

async function processJob(job: Pick<Job, 'name' | 'data'>): Promise<unknown> {
  switch (job.name) {
    case JOB_PING:
      return processPing(job.data as PingJobData);
    case JOB_REVIEW_MATERIALIZE:
      return processReviewMaterialize(job.data as ReviewMaterializeJobData);
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }
}

async function main(): Promise<void> {
  await getQueue().upsertJobScheduler(
    REVIEW_MATERIALIZE_SCHEDULER_ID,
    { pattern: REVIEW_MATERIALIZE_CRON, tz: REVIEW_MATERIALIZE_TZ },
    { name: JOB_REVIEW_MATERIALIZE, data: { mode: 'cron' } },
  );
  workerLogger.info(
    { scheduler: REVIEW_MATERIALIZE_SCHEDULER_ID, cron: REVIEW_MATERIALIZE_CRON, tz: REVIEW_MATERIALIZE_TZ },
    'Review materialize scheduler upserted',
  );

  const worker = new Worker(QUEUE_NAME, async (job) => processJob(job), {
    connection: getQueueConnection(),
  });

  worker.on('completed', (job) => {
    workerLogger.info({ jobId: job.id, name: job.name }, 'Job completed');
  });
  worker.on('failed', (job, err) => {
    workerLogger.error({ err, jobId: job?.id, name: job?.name }, 'Job failed');
  });
  worker.on('error', (err) => {
    workerLogger.error({ err }, 'Worker error');
  });

  workerLogger.info({ queue: QUEUE_NAME }, 'Worker listening');

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    workerLogger.info({ signal }, 'Worker shutting down');
    await worker.close();
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((err: unknown) => {
  workerLogger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
