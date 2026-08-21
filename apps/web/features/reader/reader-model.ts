/** Reader UI types — local for mock stage; swap getters for API later. */

export type ReaderFontSize = 'sm' | 'md' | 'lg';

export type ReaderAiMode = 'closed' | 'inline' | 'drawer';

export type ReaderChapterStatus = 'read' | 'current' | 'unread';

export type ReaderAudioStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'failed';

export type ReaderBook = {
  id: string;
  title: string;
  chapterCount: number;
};

export type ReaderChapterMeta = {
  id: string;
  index: number;
  title: string;
  status: ReaderChapterStatus;
};

export type ReaderParagraph = {
  id: string;
  index: number;
  text: string;
};

export type ReaderProgress = {
  chapterId: string;
  paragraphId: string | null;
  offsetRatio: number;
  updatedAt: string;
};

export type ReaderAudio = {
  status: ReaderAudioStatus;
  label: string;
};

export type ReaderAiMessageSource = 'inline' | 'drawer';

export type ReaderAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source: ReaderAiMessageSource;
  anchor?: { paragraphId: string; selectedText: string };
};

export type ReaderChapterBody = ReaderChapterMeta & {
  paragraphs: ReaderParagraph[];
};

export type ReaderSession = {
  book: ReaderBook;
  chapter: ReaderChapterBody;
  chapters: ReaderChapterMeta[];
  progress: ReaderProgress;
  audio: ReaderAudio;
  ai: {
    conversationId: string;
    messages: ReaderAiMessage[];
    suggestions: string[];
  };
};

export type ReaderSelection = {
  quote: string;
  paragraphId: string;
  /** Viewport-relative top for floating UI (px). */
  top: number;
  left: number;
};
