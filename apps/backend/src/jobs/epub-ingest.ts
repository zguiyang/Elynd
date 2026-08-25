import { processContentWork } from '@/modules/content-parser';

export const JOB_EPUB_INGEST = 'epub-ingest';

export type EpubIngestJobData = {
  workId: string;
};

export async function processEpubIngest(data: EpubIngestJobData): Promise<{ ok: true; workId: string }> {
  await processContentWork(data.workId);
  return { ok: true, workId: data.workId };
}
