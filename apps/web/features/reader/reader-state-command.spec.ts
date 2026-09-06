import { describe, expect, it } from 'vitest';

import { getReaderBootstrapCommand } from '@/features/reader/reader-api';
import { isReadingStateRevisionConflict, withExpectedReadingStateRevision } from '@/features/reading-state-command';
import { ApiRequestError } from '@/lib/api-request';

describe('reading state command revision handling', () => {
  it('uses the cached revision when a command does not provide one', () => {
    expect(withExpectedReadingStateRevision({ action: 'navigate', partId: 'p2' }, 4)).toEqual({
      action: 'navigate',
      partId: 'p2',
      expectedRevision: 4,
    });
  });

  it('preserves an explicit revision and leaves create commands unchanged', () => {
    const explicit = { action: 'navigate' as const, partId: 'p2', expectedRevision: 2 };
    expect(withExpectedReadingStateRevision(explicit, 4)).toBe(explicit);
    expect(withExpectedReadingStateRevision({ action: 'open' }, undefined)).toEqual({ action: 'open' });
  });

  it('identifies only HTTP 409 state conflicts', () => {
    expect(isReadingStateRevisionConflict(new ApiRequestError({ message: 'conflict', status: 409 }))).toBe(true);
    expect(isReadingStateRevisionConflict(new ApiRequestError({ message: 'bad request', status: 400 }))).toBe(false);
    expect(isReadingStateRevisionConflict(new Error('conflict'))).toBe(false);
  });

  it('opens completed state at the resolved part without restarting it', () => {
    expect(
      getReaderBootstrapCommand({
        stateStatus: 'completed',
        resolvedPartId: 'p2',
        preferredPartId: null,
      }),
    ).toEqual({ action: 'open', partId: 'p2' });
    expect(
      getReaderBootstrapCommand({
        stateStatus: 'completed',
        resolvedPartId: 'p1',
        preferredPartId: 'p1',
      }),
    ).toEqual({ action: 'open', partId: 'p1' });
  });
});
