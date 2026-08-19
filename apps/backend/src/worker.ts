import type { Job } from 'bullmq';
import { Worker } from 'bullmq';

import type { PingJobData } from '@/jobs/ping';
import { JOB_PING, processPing } from '@/jobs/ping';
import { workerLogger } from '@/lib/logger';
import { closeQueue, getQueueConnection, QUEUE_NAME } from '@/lib/queue';

function processJob(job: Pick<Job, 'name' | 'data'>): unknown {
  switch (job.name) {
    case JOB_PING:
      return processPing(job.data as PingJobData);
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }
}

async function main(): Promise<void> {
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
