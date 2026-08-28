'use client';

import { RotateCcw } from 'lucide-react';
import { useRef } from 'react';

import type { ContentAssetTrack, WorkAudioPartRow } from '@gloaming/shared/api/content-assets';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<ContentAssetTrack['status'], string> = {
  none: '未生成',
  generating: '生成中',
  ready: '已就绪',
  stale: '已过期',
  failed: '失败',
};

type WorkAudioPartRowProps = {
  row: WorkAudioPartRow;
  index: number;
  disabled?: boolean;
  onRetry: () => void;
  onPlay: (audio: HTMLAudioElement | null) => void;
};

export function WorkAudioPartRowView({ row, index, disabled, onRetry, onPlay }: WorkAudioPartRowProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const track = row.track;
  const canPlay = track.status === 'ready' && Boolean(track.audioUrl);
  const isBusy = track.status === 'generating';

  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {String(index + 1).padStart(2, '0')}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium" title={row.title || '（无标题）'}>
        {row.title.trim() || '（无标题）'}
      </p>
      <Badge
        variant="outline"
        className={cn(
          'w-16 shrink-0 justify-center',
          track.status === 'generating' && 'border-transparent bg-brand-soft text-brand-deep',
          track.status === 'failed' && 'border-transparent bg-destructive/10 text-destructive',
          track.status === 'ready' && 'border-transparent bg-secondary text-secondary-foreground',
        )}
      >
        {isBusy ? <Spinner className="size-3" /> : STATUS_LABEL[track.status]}
      </Badge>
      <div className="w-44 shrink-0">
        {canPlay ? (
          <audio
            ref={audioRef}
            controls
            preload="none"
            className="h-8 w-full"
            src={track.audioUrl!}
            onPlay={(e) => onPlay(e.currentTarget)}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        disabled={disabled || isBusy}
        aria-label={`重试 ${row.title || row.partId}`}
        onClick={onRetry}
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
}
