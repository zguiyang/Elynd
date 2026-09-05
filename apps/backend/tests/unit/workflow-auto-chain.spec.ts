import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WORKFLOW_AUTO_CHAIN } from '@gloaming/shared';

const processContentWork = vi.fn();
const enqueue = vi.fn();

vi.mock('@/modules/content-parser', () => ({
  processContentWork: (...args: unknown[]) => processContentWork(...args),
}));

vi.mock('@/lib/queue', () => ({
  enqueue: (...args: unknown[]) => enqueue(...args),
}));

describe('WORKFLOW_AUTO_CHAIN gates', () => {
  beforeEach(() => {
    processContentWork.mockReset();
    enqueue.mockReset();
    processContentWork.mockResolvedValue(true);
    enqueue.mockResolvedValue(undefined);
  });

  it('is off by default so parse does not auto-enqueue metadata-fill', async () => {
    expect(WORKFLOW_AUTO_CHAIN).toBe(false);
    const { processContentParse } = await import('@/jobs/content-parse');
    await processContentParse({ workId: 'work-1', retryJobToken: 'retry-a' });
    expect(processContentWork).toHaveBeenCalledWith('work-1', 'retry-a');
    expect(enqueue).not.toHaveBeenCalled();
  });
});
