import { randomUUID } from 'node:crypto';

import { JOB_METADATA_FILL } from '@/jobs/work-metadata-fill';
import { enqueue } from '@/lib/queue';
import { failWorkflowEnqueue, rotateWorkflowJobToken } from '@/lib/workflow';
import { WORKFLOW_AUTO_CHAIN } from '@/lib/workflow-policy';
import { processContentWork } from '@/modules/content-parser';

export const JOB_CONTENT_PARSE = 'content-parse';

export type ContentParseJobData = {
  workId: string;
  retryJobToken: string;
};

export async function processContentParse(
  data: ContentParseJobData,
  attemptToken = randomUUID(),
): Promise<{ ok: true; workId: string }> {
  if (!(await processContentWork(data.workId, data.retryJobToken, attemptToken))) {
    return { ok: true, workId: data.workId };
  }
  // Auto-chain kept for future: when WORKFLOW_AUTO_CHAIN flips back to true,
  // parse success immediately queues metadata-fill without an admin click.
  if (WORKFLOW_AUTO_CHAIN) {
    const retryJobToken = randomUUID();
    if (
      !(await rotateWorkflowJobToken(
        data.workId,
        'parse',
        'metadata',
        data.retryJobToken,
        attemptToken,
        retryJobToken,
        'metadata',
      ))
    ) {
      return { ok: true, workId: data.workId };
    }
    try {
      await enqueue(
        JOB_METADATA_FILL,
        { workId: data.workId, retryJobToken },
        { attempts: 2, jobId: `${JOB_METADATA_FILL}:${data.workId}:${retryJobToken}` },
      );
    } catch (error) {
      await failWorkflowEnqueue(data.workId, 'metadata', retryJobToken, 'metadata', attemptToken, error);
      throw error;
    }
  }
  return { ok: true, workId: data.workId };
}
