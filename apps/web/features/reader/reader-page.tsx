'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAuthDialog } from '@/features/auth';
import { ReaderAiDrawer } from '@/features/reader/reader-ai-drawer';
import { ReaderAiInline } from '@/features/reader/reader-ai-inline';
import {
  formatReaderApiError,
  getReaderAudioTrack,
  resolvePartId,
  toReaderViewModel,
  useReaderPartQuery,
  useReaderPartsQuery,
  useReaderStateMutation,
  useReadingStateQuery,
} from '@/features/reader/reader-api';
import { streamAssistAsk } from '@/features/reader/reader-assist-api';
import { ReaderChapterNav } from '@/features/reader/reader-chapter-nav';
import { ReaderChrome } from '@/features/reader/reader-chrome';
import type {
  ReaderAiMessage,
  ReaderAiMode,
  ReaderAudioStatus,
  ReaderFontSize,
  ReaderSelection,
  ReaderViewModel,
} from '@/features/reader/reader-model';
import { adjacentPart, partIndex } from '@/features/reader/reader-model';
import { ReaderPart, ReaderPartSkeleton } from '@/features/reader/reader-part';
import { ReaderSelectionToolbar } from '@/features/reader/reader-selection-toolbar';
import { ReaderTocSidebar } from '@/features/reader/reader-toc-sidebar';
import { ReaderTts } from '@/features/reader/reader-tts';
import { ReaderUnavailable } from '@/features/reader/reader-unavailable';
import { ApiRequestError } from '@/lib/api-request';
import { authClient } from '@/lib/auth';

type ReaderPageProps = {
  workId: string;
};

type InlineAssistKind = 'explain' | 'translate' | 'ask';

const FONT_CYCLE: ReaderFontSize[] = ['sm', 'md', 'lg'];

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

export function ReaderPage({ workId }: ReaderPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredPartId = searchParams.get('part')?.trim() || null;
  const { openLogin } = useAuthDialog();
  const { data: authData } = authClient.useSession();
  const isAuthenticated = Boolean(authData?.user);

  const partsQuery = useReaderPartsQuery(workId);
  const stateQuery = useReadingStateQuery(workId);
  const stateMutation = useReaderStateMutation(workId);

  const [activePartId, setActivePartId] = useState<string | null>(null);
  const partQuery = useReaderPartQuery(activePartId);
  const [localProgressRatio, setLocalProgressRatio] = useState<number | null>(null);
  const bootstrapStartedRef = useRef(false);

  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
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

  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assistAbortRef = useRef<AbortController | null>(null);

  const partsData = partsQuery.data;
  const stateData = stateQuery.data ?? null;

  useEffect(() => {
    if (!partsData || bootstrapStartedRef.current) return;
    if (isAuthenticated && stateQuery.isPending) return;

    bootstrapStartedRef.current = true;
    const partId = resolvePartId(partsData.parts, stateData, preferredPartId);

    void (async () => {
      if (!isAuthenticated) {
        setActivePartId(partId);
        return;
      }
      try {
        if (stateData?.status === 'completed') {
          const restarted = await stateMutation.mutateAsync({ action: 'restart' });
          setLocalProgressRatio(restarted.progressRatio);
          setActivePartId(restarted.currentPartId ?? partId);
          return;
        }
        const opened = await stateMutation.mutateAsync({
          action: 'open',
          partId: preferredPartId ?? undefined,
        });
        setLocalProgressRatio(opened.progressRatio);
        setActivePartId(opened.currentPartId ?? partId);
      } catch (error) {
        toast.error(formatReaderApiError(error));
        setActivePartId(partId);
      }
    })();
  }, [partsData, stateData, stateQuery.isPending, isAuthenticated, preferredPartId, stateMutation]);

  useEffect(() => {
    if (!partsData || !activePartId) return;
    scrollContainerRef.current?.scrollTo(0, 0);
  }, [activePartId, partsData]);

  useEffect(() => {
    if (!isTapHintVisible || !partsData) return;
    const t = window.setTimeout(() => setIsTapHintVisible(false), 3500);
    return () => window.clearTimeout(t);
  }, [isTapHintVisible, partsData]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      assistAbortRef.current?.abort();
    };
  }, []);

  const reader: ReaderViewModel | null =
    partsData && partQuery.data ? toReaderViewModel(partsData, partQuery.data, stateQuery.data ?? null) : null;

  const navigateToPart = useCallback(
    async (partId: string, mode: 'navigate' | 'complete_chapter', nextPartId?: string) => {
      if (!isAuthenticated) {
        openLogin({ reason: 'sync' });
        return;
      }
      try {
        const updated =
          mode === 'navigate'
            ? await stateMutation.mutateAsync({ action: 'navigate', partId })
            : await stateMutation.mutateAsync({ action: 'complete_chapter', nextPartId });
        setLocalProgressRatio(updated.progressRatio);
        setActivePartId(updated.currentPartId ?? partId);
        router.replace(`/read/${workId}?part=${encodeURIComponent(updated.currentPartId ?? partId)}`, {
          scroll: false,
        });
      } catch (error) {
        toast.error(formatReaderApiError(error));
      }
    },
    [isAuthenticated, openLogin, router, stateMutation, workId],
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
    if (!reader) return;
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
          workId,
          partId: reader.partId,
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
      if (error instanceof ApiRequestError && error.status === 401) {
        openLogin({ reason: 'ai' });
        return;
      }
      toast.error(formatReaderApiError(error));
    }
  }

  function requestInlineAssist(kind: InlineAssistKind) {
    if (!selection) return;
    void runAssist(kind, selection.quote, selection.paragraphId);
  }

  function sendDrawerMessage(text: string) {
    const selectedText = selection?.quote ?? '';
    const paragraphId = selection?.paragraphId ?? '';
    void runAssist('ask', selectedText || text, paragraphId, text, 'drawer');
  }

  async function handleTtsToggle() {
    if (!reader) return;

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

    const role = reader.audioAvailable.us ? 'us' : reader.audioAvailable.uk ? 'uk' : null;
    if (!role) {
      toast.error('暂无音频');
      return;
    }

    setAudioStatus('loading');
    try {
      const track = await getReaderAudioTrack(reader.partId, role);
      audioRef.current?.pause();
      const audio = new Audio(track.audioUrl);
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

  async function handleFinish() {
    if (!isAuthenticated) {
      openLogin({ reason: 'sync' });
      return;
    }
    try {
      const updated = await stateMutation.mutateAsync({ action: 'finish' });
      setLocalProgressRatio(updated.progressRatio);
      router.push('/my-shelf');
    } catch (error) {
      toast.error(formatReaderApiError(error));
    }
  }

  const isLoading =
    partsQuery.isPending ||
    partQuery.isPending ||
    (isAuthenticated && (stateQuery.isPending || (Boolean(partsData) && activePartId === null)));

  if (isLoading) {
    return (
      <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
        <ReaderPartSkeleton />
      </div>
    );
  }

  if (partsQuery.isError || partQuery.isError || !reader) {
    return (
      <ReaderUnavailable
        onRetry={() => {
          void partsQuery.refetch();
          void partQuery.refetch();
          void stateQuery.refetch();
        }}
        message={
          partsQuery.error
            ? formatReaderApiError(partsQuery.error)
            : partQuery.error
              ? formatReaderApiError(partQuery.error)
              : undefined
        }
      />
    );
  }

  const currentIndex = partIndex(reader.parts, reader.partId);
  const nextPart = adjacentPart(reader.parts, reader.partId, 'next');
  const prevPart = adjacentPart(reader.parts, reader.partId, 'prev');
  const progressRatio = localProgressRatio ?? stateData?.progressRatio ?? reader.state?.progressRatio ?? 0;
  const chapterLabel =
    reader.state && reader.state.totalPartCount > 1 ? `${currentIndex + 1} / ${reader.state.totalPartCount}` : null;
  const isDrawerOpen = aiMode === 'drawer';
  const isInlineOpen = aiMode === 'inline' && Boolean(selection);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <ReaderTocSidebar
        open={isTocOpen}
        onOpenChange={setIsTocOpen}
        reader={{ ...reader, state: reader.state }}
        currentPartId={reader.partId}
        onSelectChapter={(partId) => void navigateToPart(partId, 'navigate')}
      />

      <ReaderChrome
        visible={isChromeVisible}
        workTitle={reader.workTitle}
        partTitle={reader.partTitle}
        chapterLabel={chapterLabel}
        progressRatio={progressRatio}
        fontSize={fontSize}
        aiOpen={isDrawerOpen}
        tocOpen={isTocOpen}
        isListening={audioStatus === 'playing' || audioStatus === 'paused' || audioStatus === 'loading'}
        onToggleToc={() => {
          setIsTocOpen((v) => !v);
          setIsChromeVisible(true);
        }}
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

      <ReaderPart
        title={reader.partTitle}
        partId={reader.partId}
        html={reader.html}
        fontSize={fontSize}
        aiDrawerOpen={isDrawerOpen}
        tocOpen={isTocOpen}
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
        onScroll={(event) => {
          scrollContainerRef.current = event.currentTarget;
        }}
        footer={
          <ReaderChapterNav
            parts={reader.parts}
            currentPartId={reader.partId}
            nextTitle={nextPart?.title ?? null}
            hasNext={Boolean(nextPart)}
            isLastChapter={!nextPart}
            onPrevious={() => {
              if (prevPart) void navigateToPart(prevPart.id, 'navigate');
            }}
            onNext={() => {
              if (nextPart) void navigateToPart(reader.partId, 'complete_chapter', nextPart.id);
            }}
            onFinish={() => void handleFinish()}
          />
        }
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
        tocOpen={isTocOpen}
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
