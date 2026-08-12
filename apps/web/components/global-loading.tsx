'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const PHRASES = ['正在翻开下一页…', '字句在路上…', '泡一壶茶，马上回来…', '书架轻轻挪动中…'] as const;

const PHRASE_INTERVAL_MS = 2400;
const PHRASE_FADE_MS = 280;

type GlobalLoadingProps = {
  /** When set, shows a fixed line instead of rotating phrases. */
  label?: string;
  className?: string;
};

/** Full-viewport overlay — route `loading.tsx` and shell session waits. */
export function GlobalLoading({ label, className }: GlobalLoadingProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isPhraseVisible, setIsPhraseVisible] = useState(true);
  const isRotating = label == null;

  useEffect(() => {
    if (!isRotating) {
      return;
    }

    let fadeTimer: number | undefined;

    const intervalId = window.setInterval(() => {
      setIsPhraseVisible(false);
      fadeTimer = window.setTimeout(() => {
        setPhraseIndex((current) => (current + 1) % PHRASES.length);
        setIsPhraseVisible(true);
      }, PHRASE_FADE_MS);
    }, PHRASE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      if (fadeTimer != null) {
        window.clearTimeout(fadeTimer);
      }
    };
  }, [isRotating]);

  const phrase = label ?? PHRASES[phraseIndex];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center bg-background/55 px-6 backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative flex size-16 items-center justify-center" aria-hidden>
          <span className="absolute size-14 rounded-full bg-brand-soft/70 motion-safe:animate-loading-soft-ring" />
          <span className="absolute size-9 rounded-full bg-paper/90 ring-1 ring-foreground/5" />
          <span className="relative flex items-end gap-1.5 pb-0.5">
            <span className="h-3 w-1 origin-bottom rounded-full bg-primary/80 motion-safe:animate-loading-page" />
            <span className="h-4 w-1 origin-bottom rounded-full bg-primary motion-safe:animate-loading-page [animation-delay:120ms]" />
            <span className="h-3.5 w-1 origin-bottom rounded-full bg-brand-deep/70 motion-safe:animate-loading-page [animation-delay:240ms]" />
          </span>
        </div>

        <div className="flex min-h-12 flex-col items-center gap-2 text-center">
          <p
            className={cn(
              'font-heading text-lg tracking-tight text-foreground',
              'transition-opacity duration-300 ease-out-soft',
              isRotating && !isPhraseVisible ? 'opacity-0' : 'opacity-100',
            )}
          >
            {phrase}
          </p>
          <p className="text-xs tracking-[0.18em] text-muted-foreground">稍等片刻</p>
        </div>
      </div>
    </div>
  );
}
