'use client';

import { useQuery } from '@tanstack/react-query';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { type LearnAudioAvailability } from '@gloaming/shared/api/learn';
import { type TtsVoiceRole, type TtsWordTiming } from '@gloaming/shared/api/tts';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  defaultLearnAudioRole,
  formatLearnAudioApiError,
  getLearnArticleAudioTrack,
  learnAudioQueryKey,
} from '@/features/learn/learn-audio-api';
import { activeWordSyncKey, findActiveWordTiming } from '@/features/learn/learn-audio-sync';
import { cn } from '@/lib/utils';

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];

const ROLE_LABEL: Record<TtsVoiceRole, string> = {
  us: '美音',
  uk: '英音',
};

const ROLE_SHORT: Record<TtsVoiceRole, string> = {
  us: '美',
  uk: '英',
};

type LearnAudioBarProps = {
  articleId: string;
  audioAvailable: LearnAudioAvailability;
  className?: string;
  onSyncChange?: (sync: { timeMs: number | null; wordTimings: TtsWordTiming[] | null }) => void;
};

function nextPlaybackRate(current: PlaybackRate): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]!;
}

function nextAvailableRole(available: LearnAudioAvailability, current: TtsVoiceRole): TtsVoiceRole {
  const roles = (['us', 'uk'] as const).filter((item) => available[item]);
  if (roles.length === 0) {
    return current;
  }
  if (roles.length === 1) {
    return roles[0]!;
  }
  const index = roles.indexOf(current);
  return roles[(index + 1) % roles.length]!;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function resolveRole(available: LearnAudioAvailability, preferred: TtsVoiceRole | null): TtsVoiceRole | null {
  if (preferred && available[preferred]) {
    return preferred;
  }
  return defaultLearnAudioRole(available);
}

/**
 * Always-visible footer listen strip (paused by default): play · progress · rate · accent.
 */
export function LearnAudioBar({ articleId, audioAvailable, className, onSyncChange }: LearnAudioBarProps) {
  const [roleOverride, setRoleOverride] = useState<TtsVoiceRole | null>(null);
  const [shouldFetchTrack, setShouldFetchTrack] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaybackEnded, setIsPlaybackEnded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const rateRef = useRef(playbackRate);
  const playAfterLoadRef = useRef(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const onSyncChangeRef = useRef(onSyncChange);
  const lastSyncKeyRef = useRef<string | null>(null);

  const role = resolveRole(audioAvailable, roleOverride);
  const isRoleReady = role ? audioAvailable[role] : false;
  const canCycleRole = (audioAvailable.us ? 1 : 0) + (audioAvailable.uk ? 1 : 0) > 1;

  const trackQuery = useQuery({
    queryKey: learnAudioQueryKey.track(articleId, role ?? 'us'),
    queryFn: ({ signal }) => getLearnArticleAudioTrack(articleId, role!, { signal }),
    enabled: shouldFetchTrack && Boolean(role) && isRoleReady,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    onSyncChangeRef.current = onSyncChange;
  }, [onSyncChange]);

  function publishSync(timeMs: number | null, wordTimings: TtsWordTiming[] | null, force = false) {
    const sync = onSyncChangeRef.current;
    if (!sync) {
      return;
    }
    if (timeMs == null || !wordTimings?.length) {
      const key = 'idle';
      if (!force && lastSyncKeyRef.current === key) {
        return;
      }
      lastSyncKeyRef.current = key;
      sync({ timeMs: null, wordTimings: wordTimings?.length ? wordTimings : null });
      return;
    }
    const active = findActiveWordTiming(wordTimings, timeMs);
    const key = activeWordSyncKey(active);
    if (!force && lastSyncKeyRef.current === key) {
      return;
    }
    lastSyncKeyRef.current = key;
    sync({ timeMs, wordTimings });
  }

  useEffect(() => {
    rateRef.current = playbackRate;
    const element = audioRef.current;
    if (element) {
      element.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Media-clock loop while playing (fixes sparse timeupdate + high rate).
  useEffect(() => {
    if (!isPlaying || isPlaybackEnded) {
      return;
    }
    let frame = 0;
    const tick = () => {
      const element = audioRef.current;
      const timings = trackQuery.data?.wordTimings ?? null;
      if (element && timings) {
        const seconds = element.currentTime;
        setCurrentTime(seconds);
        publishSync(seconds * 1000, timings);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isPlaying, isPlaybackEnded, trackQuery.data]);

  useEffect(() => {
    if (!shouldFetchTrack || !trackQuery.data) {
      lastSyncKeyRef.current = null;
      publishSync(null, null, true);
      return;
    }
    if (isPlaybackEnded) {
      publishSync(null, trackQuery.data.wordTimings, true);
    }
    // While paused, highlight was already published on pause; avoid forcing timeMs=0 on fresh track.
  }, [shouldFetchTrack, trackQuery.data, isPlaybackEnded]);

  useEffect(() => {
    const element = audioRef.current;
    const track = trackQuery.data;
    if (!element || !track || !role) {
      return;
    }
    const key = `${role}:${track.audioBase64.slice(0, 32)}`;
    if (loadedKeyRef.current === key) {
      return;
    }
    loadedKeyRef.current = key;
    element.src = `data:${track.mimeType};base64,${track.audioBase64}`;
    element.load();
    element.playbackRate = rateRef.current;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaybackEnded(false);
    lastSyncKeyRef.current = null;
    if (playAfterLoadRef.current) {
      playAfterLoadRef.current = false;
      void element
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          toast.error('音频播放失败');
        });
    } else {
      setIsPlaying(false);
      publishSync(null, track.wordTimings, true);
    }
  }, [trackQuery.data, role]);

  useEffect(() => {
    const element = audioRef.current;
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute('src');
      }
    };
  }, []);

  useEffect(() => {
    if (!trackQuery.isError || !shouldFetchTrack) {
      return;
    }
    const error = trackQuery.error;
    const timer = window.setTimeout(() => {
      toast.error(formatLearnAudioApiError(error));
      playAfterLoadRef.current = false;
      setIsPlaying(false);
      loadedKeyRef.current = null;
      publishSync(null, null, true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [trackQuery.isError, trackQuery.error, shouldFetchTrack]);

  if (!role) {
    return null;
  }
  const activeRole = role;

  function togglePlayPause() {
    const element = audioRef.current;
    if (!shouldFetchTrack) {
      playAfterLoadRef.current = true;
      setShouldFetchTrack(true);
      return;
    }
    if (!element || trackQuery.isFetching) {
      return;
    }
    if (!trackQuery.data) {
      playAfterLoadRef.current = true;
      return;
    }
    if (element.paused) {
      setIsPlaybackEnded(false);
      void element
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          toast.error('音频播放失败');
        });
    } else {
      element.pause();
      setIsPlaying(false);
      const timeMs = element.currentTime * 1000;
      setCurrentTime(element.currentTime);
      publishSync(timeMs, trackQuery.data.wordTimings, true);
    }
  }

  function cycleRole() {
    if (!canCycleRole) {
      return;
    }
    const next = nextAvailableRole(audioAvailable, activeRole);
    if (next === activeRole) {
      return;
    }
    loadedKeyRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaybackEnded(false);
    lastSyncKeyRef.current = null;
    publishSync(null, null, true);
    if (shouldFetchTrack) {
      playAfterLoadRef.current = isPlaying;
      setIsPlaying(false);
    }
    setRoleOverride(next);
  }

  function seekFromClientX(clientX: number) {
    const element = audioRef.current;
    const track = progressRef.current;
    if (!element || !track || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setIsPlaybackEnded(false);
    element.currentTime = ratio * duration;
    setCurrentTime(element.currentTime);
    if (trackQuery.data) {
      publishSync(element.currentTime * 1000, trackQuery.data.wordTimings, true);
    }
  }

  function cycleRate() {
    const next = nextPlaybackRate(playbackRate);
    setPlaybackRate(next);
    const element = audioRef.current;
    if (element) {
      element.playbackRate = next;
      rateRef.current = next;
      setCurrentTime(element.currentTime);
      if (trackQuery.data && !isPlaybackEnded) {
        publishSync(element.currentTime * 1000, trackQuery.data.wordTimings, true);
      }
    }
  }

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const rateTooltip = `播放速度 ${playbackRate}×，点击切换`;
  const roleTooltip = canCycleRole ? `当前${ROLE_LABEL[activeRole]}，点击切换` : `当前${ROLE_LABEL[activeRole]}`;
  const playTooltip = isPlaying ? '暂停' : '播放';

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => {
          setIsPlaybackEnded(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setIsPlaybackEnded(true);
        }}
      />

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground',
                isPlaying ? 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground' : null,
              )}
              aria-label={playTooltip}
              disabled={!isRoleReady || trackQuery.isFetching}
              onClick={togglePlayPause}
            />
          }
        >
          {isPlaying ? (
            <PauseIcon className="size-4" strokeWidth={1.5} aria-hidden />
          ) : (
            <PlayIcon className="size-4" strokeWidth={1.5} aria-hidden />
          )}
        </TooltipTrigger>
        <TooltipContent side="top">{playTooltip}</TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          ref={progressRef}
          role="slider"
          tabIndex={0}
          aria-label="播放进度"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          className={cn(
            'relative h-7 min-w-[5rem] flex-1 cursor-pointer touch-none rounded-full',
            duration <= 0 ? 'opacity-50' : null,
          )}
          onPointerDown={(event) => {
            if (duration <= 0) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
              return;
            }
            seekFromClientX(event.clientX);
          }}
          onKeyDown={(event) => {
            const element = audioRef.current;
            if (!element || duration <= 0) {
              return;
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setIsPlaybackEnded(false);
              element.currentTime = Math.min(duration, element.currentTime + 5);
              setCurrentTime(element.currentTime);
              if (trackQuery.data) {
                publishSync(element.currentTime * 1000, trackQuery.data.wordTimings, true);
              }
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setIsPlaybackEnded(false);
              element.currentTime = Math.max(0, element.currentTime - 5);
              setCurrentTime(element.currentTime);
              if (trackQuery.data) {
                publishSync(element.currentTime * 1000, trackQuery.data.wordTimings, true);
              }
            }
          }}
        >
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
          <span
            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-primary"
            style={{ width: `${progressRatio * 100}%` }}
          />
          <span
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm"
            style={{ left: `${progressRatio * 100}%` }}
          />
        </div>
        <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
          {formatClock(currentTime)}
          <span className="text-border">/</span>
          {formatClock(duration)}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label={rateTooltip}
              onClick={cycleRate}
            />
          }
        >
          <span className="text-[11px] font-semibold tabular-nums tracking-tight">{playbackRate}×</span>
        </TooltipTrigger>
        <TooltipContent side="top">{rateTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label={roleTooltip}
              disabled={!canCycleRole}
              onClick={cycleRole}
            />
          }
        >
          <span className="text-[11px] font-semibold tracking-wide">{ROLE_SHORT[activeRole]}</span>
        </TooltipTrigger>
        <TooltipContent side="top">{roleTooltip}</TooltipContent>
      </Tooltip>

      {trackQuery.isFetching ? (
        <span className="sr-only" aria-live="polite">
          音频加载中
        </span>
      ) : null}
    </div>
  );
}
