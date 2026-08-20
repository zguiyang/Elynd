import {
  type LearnArticleAudioTrack,
  learnArticleAudioTrackSchema,
  type LearnAudioAvailability,
} from '@gloaming/shared/api/learn';
import { type TtsVoiceRole } from '@gloaming/shared/api/tts';

import { learnQueryKey } from '@/features/learn/learn-api';
import { apiRequest, formatApiError } from '@/lib/api-request';

export const learnAudioQueryKey = {
  track: (articleId: string, role: TtsVoiceRole) => [...learnQueryKey.all, 'audio', articleId, role] as const,
};

export function hasAnyLearnAudio(available: LearnAudioAvailability): boolean {
  return available.us || available.uk;
}

export function defaultLearnAudioRole(available: LearnAudioAvailability): TtsVoiceRole | null {
  if (available.us) {
    return 'us';
  }
  if (available.uk) {
    return 'uk';
  }
  return null;
}

export async function getLearnArticleAudioTrack(
  articleId: string,
  role: TtsVoiceRole,
  init?: { signal?: AbortSignal },
): Promise<LearnArticleAudioTrack> {
  return apiRequest(`/api/learn/articles/${encodeURIComponent(articleId)}/audio?role=${encodeURIComponent(role)}`, {
    schema: learnArticleAudioTrackSchema,
    signal: init?.signal,
  });
}

export const formatLearnAudioApiError = formatApiError;
