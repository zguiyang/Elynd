import { JOB_METADATA_FILL } from '@/jobs/work-metadata-fill';
import { enqueue } from '@/lib/queue';
import { processContentWork } from '@/modules/content-parser';

export const JOB_CONTENT_PARSE = 'content-parse';

export type ContentParseJobData = {
  workId: string;
};

export async function processContentParse(data: ContentParseJobData): Promise<{ ok: true; workId: string }> {
  await processContentWork(data.workId);
  await enqueue(JOB_METADATA_FILL, { workId: data.workId }, { attempts: 2 });
  return { ok: true, workId: data.workId };
}
