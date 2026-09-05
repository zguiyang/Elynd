import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    update: mocks.update,
  },
}));

import { claimWorkflowStep, completeWorkflowStep, failWorkflowStep } from '@/lib/workflow';

describe('workflow CAS helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ returning: mocks.returning });
  });

  it('reports claim ownership from the conditional update result', async () => {
    mocks.returning.mockResolvedValueOnce([{ id: 'work-1' }]).mockResolvedValueOnce([]);

    await expect(claimWorkflowStep('work-1', 'metadata')).resolves.toBe(true);
    await expect(claimWorkflowStep('work-1', 'metadata')).resolves.toBe(false);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.returning).toHaveBeenCalledTimes(2);
  });

  it('rejects stale completion and failure updates when no row is affected', async () => {
    mocks.returning.mockResolvedValue([]);

    await expect(completeWorkflowStep('work-1', 'ready', undefined, 'tts')).resolves.toBe(false);
    await expect(failWorkflowStep('work-1', 'tts', new Error('stale'))).resolves.toBe(false);
    expect(mocks.where).toHaveBeenCalledTimes(2);
    expect(mocks.returning).toHaveBeenCalledTimes(2);
  });
});
