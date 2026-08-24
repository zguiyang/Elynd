/** Reader UI types — aligned with ReaderSessionData after API adapter. */

import type { ArticleLevel } from '@gloaming/shared/api/articles';
import type { ReaderAudioAvailability, ReadingProgressStatus } from '@gloaming/shared/api/reader';

export type ReaderFontSize = 'sm' | 'md' | 'lg';

export type ReaderAiMode = 'closed' | 'inline' | 'drawer';

export type ReaderAudioStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'failed';

export type ReaderParagraph = {
  id: string;
  index: number;
  text: string;
};

export type ReaderAiMessageSource = 'inline' | 'drawer';

export type ReaderAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: ReaderAiMessageSource;
  anchor?: { paragraphId: string; selectedText: string };
};

export type ReaderSession = {
  id: string;
  title: string;
  level: ArticleLevel;
  themes: string[];
  estimatedMinutes: number | null;
  paragraphs: ReaderParagraph[];
  progress: {
    status: ReadingProgressStatus;
    progressRatio: number;
    lastReadAt: string;
    completedAt: string | null;
  };
  audioAvailable: ReaderAudioAvailability;
};

export type ReaderSelection = {
  quote: string;
  paragraphId: string;
  /** Viewport-relative top for floating UI (px). */
  top: number;
  left: number;
};
