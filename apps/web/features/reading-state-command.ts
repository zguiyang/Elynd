import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type ReadingState, readingStateSchema, type UpdateReadingStateBody } from '@gloaming/shared/api/reader';

import { apiRequest } from '@/lib/api-request';

export async function patchReadingState(
  workId: string,
  body: UpdateReadingStateBody,
  init?: { signal?: AbortSignal },
): Promise<ReadingState> {
  return apiRequest(`/api/reader/works/${encodeURIComponent(workId)}/state`, {
    method: 'PATCH',
    schema: readingStateSchema,
    json: body,
    signal: init?.signal,
  });
}

/** Silent shelf add — creates 0% state without opening reader. */
export async function addWorkToShelf(workId: string): Promise<void> {
  await patchReadingState(workId, { action: 'add_to_shelf' });
}

export function useAddToShelfMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workId: string) => addWorkToShelf(workId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
      await queryClient.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}
