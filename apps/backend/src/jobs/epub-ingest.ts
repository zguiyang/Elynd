import { processEpubWork } from '@/modules/epub-ingest/service';

export const JOB_EPUB_INGEST = 'epub-ingest';

export type EpubIngestJobData = {
  workId: string;
};

export async function processEpubIngest(data: EpubIngestJobData): Promise<{ ok: true; workId: string }> {
  await processEpubWork(data.workId);
  return { ok: true, workId: data.workId };
}
