import { processContentWork } from '@/modules/content-parser';

export const JOB_CONTENT_PARSE = 'content-parse';

export type ContentParseJobData = {
  workId: string;
};

export async function processContentParse(data: ContentParseJobData): Promise<{ ok: true; workId: string }> {
  await processContentWork(data.workId);
  return { ok: true, workId: data.workId };
}
