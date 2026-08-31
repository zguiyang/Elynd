/** Reader UI types — aligned with split reader APIs. */

import type { ReaderAudioAvailability, ReadingStateStatus } from '@gloaming/shared/api/reader';
import type { PartSummary } from '@gloaming/shared/api/works';

export type ReaderFontSize = 'sm' | 'md' | 'lg';

export type ReaderAiMode = 'closed' | 'inline' | 'drawer';

export type ReaderAudioStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'failed';

export type ReaderAiMessageSource = 'inline' | 'drawer';

export type ReaderAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: ReaderAiMessageSource;
  anchor?: { paragraphId: string; selectedText: string };
};

export type ReaderProgressState = {
  status: ReadingStateStatus;
  progressRatio: number;
  completedThroughSortOrder: number;
  totalPartCount: number;
  lastReadAt: string;
  completedAt: string | null;
};

export type ReaderViewModel = {
  workId: string;
  workTitle: string;
  coverAssetId: string | null;
  tags: string[];
  parts: PartSummary[];
  partId: string;
  partTitle: string;
  sortOrder: number;
  html: string;
  state: ReaderProgressState | null;
  audioAvailable: ReaderAudioAvailability;
};

/** @deprecated Use ReaderViewModel */
export type ReaderSession = ReaderViewModel & {
  title: string;
};

export type ReaderSelection = {
  quote: string;
  paragraphId: string;
  top: number;
  left: number;
};

export function sortedParts(parts: PartSummary[]): PartSummary[] {
  return [...parts].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

export function partIndex(parts: PartSummary[], partId: string): number {
  return sortedParts(parts).findIndex((part) => part.id === partId);
}

export function adjacentPart(parts: PartSummary[], partId: string, direction: 'prev' | 'next'): PartSummary | null {
  const ordered = sortedParts(parts);
  const index = ordered.findIndex((part) => part.id === partId);
  if (index < 0) {
    return null;
  }
  const nextIndex = direction === 'prev' ? index - 1 : index + 1;
  return ordered[nextIndex] ?? null;
}

export function chapterStatusForPart(
  part: PartSummary,
  state: ReaderProgressState | null,
  currentPartId: string,
): 'read' | 'current' | 'unread' {
  if (!state) {
    return part.id === currentPartId ? 'current' : 'unread';
  }
  if (state.status === 'completed') {
    return 'read';
  }
  if (part.sortOrder <= state.completedThroughSortOrder) {
    return 'read';
  }
  if (part.id === currentPartId) {
    return 'current';
  }
  return 'unread';
}
