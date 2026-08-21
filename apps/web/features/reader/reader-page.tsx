'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { APP_NAME, AUTH_ROUTES } from '@/constants';
import { ReaderAiDrawer } from '@/features/reader/reader-ai-drawer';
import { ReaderAiInline } from '@/features/reader/reader-ai-inline';
import { ReaderArticle } from '@/features/reader/reader-article';
import { ReaderChrome } from '@/features/reader/reader-chrome';
import { getReaderChapter, getReaderSession } from '@/features/reader/reader-mock';
import type {
  ReaderAiMessage,
  ReaderAiMode,
  ReaderAudioStatus,
  ReaderFontSize,
  ReaderSelection,
  ReaderSession,
} from '@/features/reader/reader-model';
import { ReaderSelectionToolbar } from '@/features/reader/reader-selection-toolbar';
import { ReaderToc } from '@/features/reader/reader-toc';
import { ReaderTts } from '@/features/reader/reader-tts';
import { ReaderUnavailable } from '@/features/reader/reader-unavailable';

type ReaderPageProps = {
  bookId: string;
  chapterId?: string | null;
  forceUnavailable?: boolean;
};

type InlineAssistKind = 'explain' | 'translate' | 'ask';

const FONT_CYCLE: ReaderFontSize[] = ['sm', 'md', 'lg'];

function mockAssistReply(kind: InlineAssistKind, selectedText: string, question?: string): string {
  const clipped = `${selectedText.slice(0, 40)}${selectedText.length > 40 ? '…' : ''}`;
  if (kind === 'translate') {
    return `（预览译文）${selectedText}`;
  }
  if (kind === 'ask' || question) {
    return `（预览）关于「${clipped}」：${question ?? '这段是什么意思？'} — 这里会结合当前章节给出简短解释，帮助你继续往下读。`;
  }
  return `（预览）「${clipped}」大致在描写场景与氛围。理解关键词后，试着回到原文把整段再读一遍。`;
}

function inlineUserPrompt(kind: InlineAssistKind, selectedText: string): string {
  if (kind === 'translate') return `翻译：${selectedText}`;
  if (kind === 'ask') return `这段是什么意思？：${selectedText}`;
  return `解释：${selectedText}`;
}

function resolveSession(bookId: string, chapterId: string | null | undefined, forceUnavailable: boolean) {
  return getReaderSession(bookId, {
    chapterId: chapterId ?? null,
    forceUnavailable,
  });
}

export function ReaderPage({ bookId, chapterId = null, forceUnavailable = false }: ReaderPageProps) {
  const router = useRouter();
  const initial = resolveSession(bookId, chapterId, forceUnavailable);

  const [session, setSession] = useState<ReaderSession | null>(initial);
  const [phase, setPhase] = useState<'ready' | 'unavailable'>(initial ? 'ready' : 'unavailable');

  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [aiMode, setAiMode] = useState<ReaderAiMode>('closed');
  const [fontSize, setFontSize] = useState<ReaderFontSize>('md');
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [inlineAnswer, setInlineAnswer] = useState('');
  const [isInlineStreaming, setIsInlineStreaming] = useState(false);
  const [messages, setMessages] = useState<ReaderAiMessage[]>(() => initial?.ai.messages ?? []);
  const [audioStatus, setAudioStatus] = useState<ReaderAudioStatus>(() => initial?.audio.status ?? 'idle');
  const [isTapHintVisible, setIsTapHintVisible] = useState(true);

  useEffect(() => {
    if (!isTapHintVisible || phase !== 'ready') return;
    const t = window.setTimeout(() => setIsTapHintVisible(false), 3500);
    return () => window.clearTimeout(t);
  }, [isTapHintVisible, phase]);

  useEffect(() => {
    if (audioStatus !== 'playing') return;
    const t = window.setTimeout(() => setAudioStatus('paused'), 12000);
    return () => window.clearTimeout(t);
  }, [audioStatus]);

  function applyChapter(nextChapterId: string) {
    const next = getReaderChapter(bookId, nextChapterId);
    if (!next) return;
    setSession(next);
    setSelection(null);
    setAiMode('closed');
    setInlineAnswer('');
  }

  function clearSelectionUi() {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  function openDrawer() {
    setAiMode('drawer');
  }

  function closeAiSurface() {
    setAiMode('closed');
  }

  function requestInlineAssist(kind: InlineAssistKind) {
    if (!selection) return;
    const { quote: selectedText, paragraphId } = selection;
    const userContent = inlineUserPrompt(kind, selectedText);

    setAiMode('inline');
    setIsInlineStreaming(true);
    setInlineAnswer('');

    window.setTimeout(
      () => {
        const answer = mockAssistReply(kind, selectedText);
        setInlineAnswer(answer);
        setIsInlineStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-u`,
            role: 'user',
            content: userContent,
            source: 'inline',
            anchor: { paragraphId, selectedText },
          },
          {
            id: `m-${Date.now()}-a`,
            role: 'assistant',
            content: answer,
            source: 'inline',
            anchor: { paragraphId, selectedText },
          },
        ]);
      },
      kind === 'translate' ? 0 : 600,
    );
  }

  function sendDrawerMessage(text: string) {
    const selectedText = selection?.quote ?? '';
    const paragraphId = selection?.paragraphId;
    const reply = mockAssistReply('ask', selectedText || 'this passage', text);
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}-u`,
        role: 'user',
        content: text,
        source: 'drawer',
        ...(paragraphId && selectedText ? { anchor: { paragraphId, selectedText } } : {}),
      },
      {
        id: `m-${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        source: 'drawer',
        ...(paragraphId && selectedText ? { anchor: { paragraphId, selectedText } } : {}),
      },
    ]);
  }

  function handleTtsToggle() {
    if (audioStatus === 'idle' || audioStatus === 'ready') {
      setAudioStatus('loading');
      window.setTimeout(() => setAudioStatus('playing'), 500);
      return;
    }
    if (audioStatus === 'paused') {
      setAudioStatus('playing');
      return;
    }
    if (audioStatus === 'playing') {
      setAudioStatus('paused');
    }
  }

  if (phase === 'unavailable' || !session) {
    return (
      <ReaderUnavailable
        onRetry={() => {
          const next = resolveSession(bookId, chapterId, forceUnavailable);
          if (!next) {
            setPhase('unavailable');
            return;
          }
          setSession(next);
          setMessages(next.ai.messages);
          setAudioStatus(next.audio.status);
          setPhase('ready');
        }}
      />
    );
  }

  const chapterIdx = session.chapters.findIndex((c) => c.id === session.chapter.id);
  const progressRatio = (Math.max(0, chapterIdx) + session.progress.offsetRatio) / session.book.chapterCount;
  const isDrawerOpen = aiMode === 'drawer';
  const isInlineOpen = aiMode === 'inline' && Boolean(selection);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <p className="pointer-events-none absolute top-2 left-1/2 z-50 -translate-x-1/2 text-[10px] text-muted-foreground/80">
        界面预览（假数据）· {APP_NAME}
      </p>

      <ReaderChrome
        visible={isChromeVisible}
        bookTitle={session.book.title}
        chapterIndex={session.chapter.index}
        chapterCount={session.book.chapterCount}
        progressRatio={progressRatio}
        fontSize={fontSize}
        tocOpen={isTocOpen}
        aiOpen={isDrawerOpen}
        isListening={audioStatus === 'playing' || audioStatus === 'paused' || audioStatus === 'loading'}
        onToggleFontSize={() => setFontSize((f) => FONT_CYCLE[(FONT_CYCLE.indexOf(f) + 1) % FONT_CYCLE.length]!)}
        onToggleToc={() => {
          setIsTocOpen((o) => !o);
          setIsChromeVisible(true);
        }}
        onToggleAi={() => {
          setAiMode((m) => (m === 'drawer' ? 'closed' : 'drawer'));
          setIsChromeVisible(true);
        }}
        onToggleTts={() => {
          handleTtsToggle();
          setIsChromeVisible(true);
        }}
      />

      <ReaderToc
        open={isTocOpen}
        bookTitle={session.book.title}
        chapters={session.chapters}
        currentChapterId={session.chapter.id}
        onOpenChange={setIsTocOpen}
        onSelectChapter={applyChapter}
      />

      <ReaderArticle
        bookTitle={session.book.title}
        chapter={session.chapter}
        chapters={session.chapters}
        fontSize={fontSize}
        tocOpen={isTocOpen}
        aiDrawerOpen={isDrawerOpen}
        onSelectText={(payload) => {
          setSelection(payload);
          closeAiSurface();
          setInlineAnswer('');
        }}
        onPrevChapter={() => {
          const prev = session.chapters[chapterIdx - 1];
          if (prev) applyChapter(prev.id);
        }}
        onNextChapter={() => {
          const next = session.chapters[chapterIdx + 1];
          if (next) {
            applyChapter(next.id);
          } else {
            router.push(AUTH_ROUTES.shelf);
          }
        }}
        onCenterTap={() => {
          setIsChromeVisible((v) => !v);
          setIsTapHintVisible(false);
          if (selection && aiMode !== 'inline') clearSelectionUi();
        }}
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
        onOpenDrawer={openDrawer}
      />

      <ReaderAiDrawer
        open={isDrawerOpen}
        quote={selection?.quote ?? null}
        messages={messages}
        suggestions={session.ai.suggestions}
        onOpenChange={(open) => (open ? openDrawer() : closeAiSurface())}
        onSend={sendDrawerMessage}
      />

      <ReaderTts
        status={audioStatus}
        label={session.audio.label}
        tocOpen={isTocOpen}
        aiDrawerOpen={isDrawerOpen}
        onToggle={handleTtsToggle}
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
