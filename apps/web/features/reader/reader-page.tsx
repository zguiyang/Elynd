'use client';

import { useRouter } from 'next/navigation';
import { type UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ReaderAiDrawer } from '@/features/reader/reader-ai-drawer';
import { ReaderAiInline } from '@/features/reader/reader-ai-inline';
import {
  formatReaderApiError,
  getReaderAudioTrack,
  updateReadingProgress,
  useReaderSessionQuery,
  useUpdateReadingProgressMutation,
} from '@/features/reader/reader-api';
import { ReaderArticle, ReaderArticleSkeleton } from '@/features/reader/reader-article';
import { streamAssistAsk } from '@/features/reader/reader-assist-api';
import { ReaderChrome } from '@/features/reader/reader-chrome';
import type {
  ReaderAiMessage,
  ReaderAiMode,
  ReaderAudioStatus,
  ReaderFontSize,
  ReaderSelection,
} from '@/features/reader/reader-model';
import { pendingProgressFlushRatio, scrollProgressRatio } from '@/features/reader/reader-progress';
import { ReaderSelectionToolbar } from '@/features/reader/reader-selection-toolbar';
import { ReaderTts } from '@/features/reader/reader-tts';
import { ReaderUnavailable } from '@/features/reader/reader-unavailable';

type ReaderPageProps = {
  articleId: string;
};

type InlineAssistKind = 'explain' | 'translate' | 'ask';

const FONT_CYCLE: ReaderFontSize[] = ['sm', 'md', 'lg'];
const PROGRESS_DEBOUNCE_MS = 800;

function actionIdForKind(kind: InlineAssistKind): 'explain' | 'meaning' | 'qa' {
  if (kind === 'translate') return 'meaning';
  if (kind === 'ask') return 'qa';
  return 'explain';
}

function inlineUserPrompt(kind: InlineAssistKind, selectedText: string): string {
  if (kind === 'translate') return `翻译：${selectedText}`;
  if (kind === 'ask') return `这段是什么意思？：${selectedText}`;
  return `解释：${selectedText}`;
}

export function ReaderPage({ articleId }: ReaderPageProps) {
  const router = useRouter();
  const sessionQuery = useReaderSessionQuery(articleId);
  const progressMutation = useUpdateReadingProgressMutation(articleId);

  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [aiMode, setAiMode] = useState<ReaderAiMode>('closed');
  const [fontSize, setFontSize] = useState<ReaderFontSize>('md');
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [inlineAnswer, setInlineAnswer] = useState('');
  const [isInlineStreaming, setIsInlineStreaming] = useState(false);
  const [messages, setMessages] = useState<ReaderAiMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [audioStatus, setAudioStatus] = useState<ReaderAudioStatus>('idle');
  const [audioLabel, setAudioLabel] = useState('听读');
  const [isTapHintVisible, setIsTapHintVisible] = useState(true);

  const scrollRef = useRef<HTMLElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const pendingRatioRef = useRef<number | null>(null);
  const lastSentRatioRef = useRef<number>(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assistAbortRef = useRef<AbortController | null>(null);

  const session = sessionQuery.data;

  useEffect(() => {
    if (!isTapHintVisible || !session) return;
    const t = window.setTimeout(() => setIsTapHintVisible(false), 3500);
    return () => window.clearTimeout(t);
  }, [isTapHintVisible, session]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      assistAbortRef.current?.abort();
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current);
      }
      const pending = pendingProgressFlushRatio(pendingRatioRef.current, lastSentRatioRef.current);
      if (pending != null) {
        void updateReadingProgress(articleId, { progressRatio: pending });
      }
    };
  }, [articleId]);

  const flushProgress = useCallback(
    (ratio: number) => {
      if (ratio === lastSentRatioRef.current) {
        pendingRatioRef.current = null;
        return;
      }
      lastSentRatioRef.current = ratio;
      pendingRatioRef.current = null;
      progressMutation.mutate({ progressRatio: ratio });
    },
    [progressMutation],
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      scrollRef.current = event.currentTarget;
      const ratio = scrollProgressRatio(event.currentTarget);
      pendingRatioRef.current = ratio;
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current);
      }
      progressTimerRef.current = window.setTimeout(() => {
        flushProgress(ratio);
      }, PROGRESS_DEBOUNCE_MS);
    },
    [flushProgress],
  );

  function clearSelectionUi() {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  function closeAiSurface() {
    setAiMode('closed');
    assistAbortRef.current?.abort();
  }

  async function runAssist(
    kind: InlineAssistKind,
    selectedText: string,
    paragraphId: string,
    question?: string,
    source: ReaderAiMessage['source'] = 'inline',
  ) {
    assistAbortRef.current?.abort();
    const controller = new AbortController();
    assistAbortRef.current = controller;

    const actionId = actionIdForKind(kind);
    const userContent = kind === 'ask' && question ? question : inlineUserPrompt(kind, selectedText);

    if (source === 'inline') {
      setAiMode('inline');
      setIsInlineStreaming(true);
      setInlineAnswer('');
    }

    try {
      const done = await streamAssistAsk(
        {
          articleId,
          actionId,
          selection: selectedText,
          question: kind === 'ask' ? question : undefined,
          conversationId,
        },
        {
          signal: controller.signal,
          onDelta: source === 'inline' ? (text) => setInlineAnswer((prev) => prev + text) : undefined,
        },
      );

      if (done.conversationId) {
        setConversationId(done.conversationId);
      }
      if (done.suggestions?.length) {
        setSuggestions(done.suggestions);
      }

      const answer = done.reply;
      if (source === 'inline') {
        setInlineAnswer(answer);
        setIsInlineStreaming(false);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}-u`,
          role: 'user',
          content: userContent,
          source,
          anchor: { paragraphId, selectedText },
        },
        {
          id: `m-${Date.now()}-a`,
          role: 'assistant',
          content: answer,
          source,
          anchor: { paragraphId, selectedText },
        },
      ]);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setIsInlineStreaming(false);
      toast.error(formatReaderApiError(error));
    }
  }

  function requestInlineAssist(kind: InlineAssistKind) {
    if (!selection) return;
    void runAssist(kind, selection.quote, selection.paragraphId);
  }

  function sendDrawerMessage(text: string) {
    const selectedText = selection?.quote ?? '';
    const paragraphId = selection?.paragraphId ?? session?.paragraphs[0]?.id ?? '';
    void runAssist('ask', selectedText || text, paragraphId, text, 'drawer');
  }

  async function handleTtsToggle() {
    if (!session) return;

    if (audioStatus === 'playing') {
      audioRef.current?.pause();
      setAudioStatus('paused');
      return;
    }

    if (audioStatus === 'paused') {
      await audioRef.current?.play();
      setAudioStatus('playing');
      return;
    }

    const role = session.audioAvailable.us ? 'us' : session.audioAvailable.uk ? 'uk' : null;
    if (!role) {
      toast.error('暂无音频');
      return;
    }

    setAudioStatus('loading');
    try {
      const track = await getReaderAudioTrack(articleId, role);
      const src = `data:${track.mimeType};base64,${track.audioBase64}`;
      audioRef.current?.pause();
      const audio = new Audio(src);
      audioRef.current = audio;
      setAudioLabel(`${track.voice} · ${role.toUpperCase()}`);
      audio.onended = () => setAudioStatus('ready');
      audio.onerror = () => setAudioStatus('failed');
      await audio.play();
      setAudioStatus('playing');
    } catch (error) {
      setAudioStatus('failed');
      toast.error(formatReaderApiError(error));
    }
  }

  function handleFinish() {
    if (progressTimerRef.current != null) {
      window.clearTimeout(progressTimerRef.current);
    }
    pendingRatioRef.current = null;
    lastSentRatioRef.current = 100;
    progressMutation.mutate({ progressRatio: 100, status: 'completed' }, { onSuccess: () => router.push('/my-shelf') });
  }

  if (sessionQuery.isPending) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
        <ReaderArticleSkeleton />
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <ReaderUnavailable
        onRetry={() => void sessionQuery.refetch()}
        message={sessionQuery.error ? formatReaderApiError(sessionQuery.error) : undefined}
      />
    );
  }

  const isDrawerOpen = aiMode === 'drawer';
  const isInlineOpen = aiMode === 'inline' && Boolean(selection);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <ReaderChrome
        visible={isChromeVisible}
        title={session.title}
        progressRatio={session.progress.progressRatio}
        fontSize={fontSize}
        aiOpen={isDrawerOpen}
        isListening={audioStatus === 'playing' || audioStatus === 'paused' || audioStatus === 'loading'}
        onToggleFontSize={() => setFontSize((f) => FONT_CYCLE[(FONT_CYCLE.indexOf(f) + 1) % FONT_CYCLE.length]!)}
        onToggleAi={() => {
          setAiMode((m) => (m === 'drawer' ? 'closed' : 'drawer'));
          setIsChromeVisible(true);
        }}
        onToggleTts={() => {
          void handleTtsToggle();
          setIsChromeVisible(true);
        }}
      />

      <ReaderArticle
        title={session.title}
        paragraphs={session.paragraphs}
        fontSize={fontSize}
        aiDrawerOpen={isDrawerOpen}
        onSelectText={(payload) => {
          setSelection(payload);
          closeAiSurface();
          setInlineAnswer('');
        }}
        onCenterTap={() => {
          setIsChromeVisible((v) => !v);
          setIsTapHintVisible(false);
          if (selection && aiMode !== 'inline') clearSelectionUi();
        }}
        onScroll={handleScroll}
        onFinish={handleFinish}
      />

      <ReaderSelectionToolbar
        visible={Boolean(selection) && aiMode === 'closed'}
        top={selection?.top ?? 0}
        left={selection?.left ?? 0}
        onExplain={() => requestInlineAssist('explain')}
        onAskAi={() => requestInlineAssist('ask')}
        onTranslate={() => requestInlineAssist('translate')}
      />

      <ReaderAiInline
        open={isInlineOpen}
        quote={selection?.quote ?? ''}
        answer={inlineAnswer}
        streaming={isInlineStreaming}
        top={(selection?.top ?? 0) + 48}
        left={selection?.left ?? 0}
        onClose={() => {
          closeAiSurface();
          clearSelectionUi();
        }}
        onOpenDrawer={() => setAiMode('drawer')}
      />

      <ReaderAiDrawer
        open={isDrawerOpen}
        quote={selection?.quote ?? null}
        messages={messages}
        suggestions={suggestions}
        onOpenChange={(open) => (open ? setAiMode('drawer') : closeAiSurface())}
        onSend={sendDrawerMessage}
      />

      <ReaderTts
        status={audioStatus}
        label={audioLabel}
        tocOpen={false}
        aiDrawerOpen={isDrawerOpen}
        onToggle={() => void handleTtsToggle()}
      />

      {isTapHintVisible ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-full bg-[var(--inverse-surface)] px-5 py-2.5 text-sm text-[var(--inverse-on-surface)] shadow-card">
            点按中央显示菜单
          </div>
        </div>
      ) : null}
    </div>
  );
}
