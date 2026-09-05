import { randomUUID } from 'node:crypto';

import { WORKFLOW_AUTO_CHAIN } from '@gloaming/shared/api/works';

import { JOB_METADATA_FILL } from '@/jobs/work-metadata-fill';
import { enqueue } from '@/lib/queue';
import { rotateWorkflowJobToken } from '@/lib/workflow';
import { processContentWork } from '@/modules/content-parser';

export const JOB_CONTENT_PARSE = 'content-parse';

export type ContentParseJobData = {
  workId: string;
  retryJobToken: string;
};

export async function processContentParse(data: ContentParseJobData): Promise<{ ok: true; workId: string }> {
  if (!(await processContentWork(data.workId, data.retryJobToken))) {
    return { ok: true, workId: data.workId };
  }
  // Auto-chain kept for future: when WORKFLOW_AUTO_CHAIN flips back to true,
  // parse success immediately queues metadata-fill without an admin click.
  if (WORKFLOW_AUTO_CHAIN) {
    const retryJobToken = randomUUID();
    if (
      !(await rotateWorkflowJobToken(data.workId, 'parse', 'metadata', data.retryJobToken, retryJobToken, 'metadata'))
    ) {
      return { ok: true, workId: data.workId };
    }
    await enqueue(
      JOB_METADATA_FILL,
      { workId: data.workId, retryJobToken },
      { attempts: 2, jobId: `${JOB_METADATA_FILL}:${data.workId}:${retryJobToken}` },
    );
  }
  return { ok: true, workId: data.workId };
}
