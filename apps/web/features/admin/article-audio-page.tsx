'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { type ArticleAudioRole, type ArticleAudioTrack } from '@elynd/shared/api/article-audio';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import {
  adminArticleAudioQueryKey,
  formatAdminArticleAudioApiError,
  generateAdminArticleAudio,
  getAdminArticleAudio,
} from '@/features/admin/article-audio-api';
import { adminArticlesQueryKey, getAdminArticle } from '@/features/admin/articles-api';

type ArticleAudioPageProps = {
  articleId: string;
};

const ROLE_LABEL: Record<ArticleAudioRole, string> = {
  us: '美音',
  uk: '英音',
};

function formatDateTime(iso: string | Date | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

function statusPresentation(track: ArticleAudioTrack): {
  label: string;
  variant: 'outline' | 'secondary' | 'destructive';
  detail?: string;
} {
  if (track.status === 'none') {
    return { label: '未生成', variant: 'outline' };
  }
  if (track.status === 'failed') {
    return { label: '失败', variant: 'destructive', detail: track.lastError ?? undefined };
  }
  if (track.expired) {
    return { label: '已过期', variant: 'outline', detail: '对象存储中已无音频，请重新生成' };
  }
  if (track.contentStale) {
    return { label: '原文已变更', variant: 'secondary', detail: '当前音频对应旧正文，建议重新生成' };
  }
  if (track.lastError) {
    return { label: '就绪（上次重生成失败）', variant: 'secondary', detail: track.lastError };
  }
  return { label: '就绪', variant: 'secondary' };
}

/**
 * Admin workspace: whole-article US/UK TTS generate / preview / regenerate.
 */
export function ArticleAudioPage({ articleId }: ArticleAudioPageProps) {
  const queryClient = useQueryClient();
  const [previewRole, setPreviewRole] = useState<ArticleAudioRole>('us');

  const articleQuery = useQuery({
    queryKey: adminArticlesQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticle(articleId, { signal }),
  });

  const audioQuery = useQuery({
    queryKey: adminArticleAudioQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticleAudio(articleId, { signal }),
  });

  const generateMutation = useMutation({
    mutationFn: (roles?: ArticleAudioRole[]) => generateAdminArticleAudio(articleId, roles ? { roles } : {}),
    onSuccess: (data, roles) => {
      queryClient.setQueryData(adminArticleAudioQueryKey.detail(articleId), data);
      const failed = data.results.filter((item) => !item.ok);
      const okCount = data.results.filter((item) => item.ok).length;
      if (failed.length === 0) {
        const hasCachedHit = data.results.some((item) => item.cached);
        toast.success(
          roles?.length === 1
            ? `${ROLE_LABEL[roles[0]!]}已生成${hasCachedHit ? '（命中缓存）' : ''}`
            : `美音与英音已生成${hasCachedHit ? '（含缓存）' : ''}`,
        );
        return;
      }
      if (okCount > 0) {
        toast.warning(`部分成功：${failed.map((item) => `${ROLE_LABEL[item.role]}失败`).join('、')}`);
        return;
      }
      toast.error(failed.map((item) => `${ROLE_LABEL[item.role]}：${item.error ?? '失败'}`).join('；'));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: adminArticleAudioQueryKey.detail(articleId) });
      toast.error(formatAdminArticleAudioApiError(error));
    },
  });

  if (articleQuery.isPending || audioQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40 bg-muted/70" />
        <Skeleton className="h-12 w-2/3 max-w-md bg-muted/70" />
        <Skeleton className="h-40 w-full rounded-3xl bg-muted/70" />
      </div>
    );
  }

  if (articleQuery.isError || !articleQuery.data) {
    return (
      <Empty className="mx-auto max-w-3xl border-0 py-16">
        <EmptyHeader>
          <EmptyTitle>无法加载文章</EmptyTitle>
          <EmptyDescription>
            {articleQuery.error ? formatAdminArticleAudioApiError(articleQuery.error) : '文章不存在'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (audioQuery.isError || !audioQuery.data) {
    return (
      <Empty className="mx-auto max-w-3xl border-0 py-16">
        <EmptyHeader>
          <EmptyTitle>无法加载音频状态</EmptyTitle>
          <EmptyDescription>
            {audioQuery.error ? formatAdminArticleAudioApiError(audioQuery.error) : '请稍后重试'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const article = articleQuery.data;
  const audio = audioQuery.data;
  const track = audio.tracks[previewRole];
  const status = statusPresentation(track);
  const hasAnyTrack = audio.tracks.us.status !== 'none' || audio.tracks.uk.status !== 'none';
  const canPreview = Boolean(track.audioAvailable && track.audioBase64 && track.mimeType);
  const pendingRoles = generateMutation.isPending ? generateMutation.variables : undefined;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-3xl pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          render={<Link href={ADMIN_ROUTES.articleEdit(articleId)} />}
        >
          ← 返回编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          render={<Link href={ADMIN_ROUTES.articles} />}
        >
          列表
        </Button>
      </div>

      <div className="mt-4">
        <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">{article.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">短文音频工作台 · 美音与英音各一条</p>
      </div>

      {article.derivedFreshness.audio === 'stale' ? (
        <Alert className="mt-6 rounded-2xl border-border bg-muted/40 px-4 py-3">
          <AlertTitle>音频需更新</AlertTitle>
          <AlertDescription>正文已变更，请重新生成美音与英音以保持与短文一致。</AlertDescription>
        </Alert>
      ) : null}

      <section className="mt-8 rounded-3xl border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {(['us', 'uk'] as const).map((role) => {
              const item = statusPresentation(audio.tracks[role]);
              return (
                <div key={role} className="flex flex-wrap items-center gap-2">
                  <span className="w-10 text-sm text-muted-foreground">{ROLE_LABEL[role]}</span>
                  <Badge variant={item.variant}>{item.label}</Badge>
                  {item.detail ? <span className="text-sm text-muted-foreground">{item.detail}</span> : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-11 rounded-xl"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate(undefined)}
            >
              {pendingRoles === undefined && generateMutation.isPending
                ? '生成中…'
                : hasAnyTrack
                  ? '重新生成全部'
                  : '生成美音与英音'}
            </Button>
            {hasAnyTrack ? (
              <>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate(['us'])}
                >
                  {pendingRoles?.length === 1 && pendingRoles[0] === 'us' ? '美音生成中…' : '重生成美音'}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={generateMutation.isPending}
                  onClick={() => generateMutation.mutate(['uk'])}
                >
                  {pendingRoles?.length === 1 && pendingRoles[0] === 'uk' ? '英音生成中…' : '重生成英音'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-foreground">预览</h2>
          <Tabs
            value={previewRole}
            onValueChange={(value) => {
              if (value === 'us' || value === 'uk') {
                setPreviewRole(value);
              }
            }}
          >
            <AdminSegmentedTabsList aria-label="切换美音或英音">
              <AdminSegmentedTabsTrigger value="us">美音</AdminSegmentedTabsTrigger>
              <AdminSegmentedTabsTrigger value="uk">英音</AdminSegmentedTabsTrigger>
            </AdminSegmentedTabsList>
          </Tabs>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>
            {ROLE_LABEL[previewRole]} · {status.label}
          </Badge>
          {status.detail ? <p className="text-sm text-muted-foreground">{status.detail}</p> : null}
        </div>

        {canPreview ? (
          <audio
            key={`${previewRole}-${track.generatedAt ?? 'na'}`}
            className="mt-4 w-full"
            controls
            src={`data:${track.mimeType};base64,${track.audioBase64}`}
          >
            浏览器不支持音频播放
          </audio>
        ) : (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyTitle>
                {track.expired ? `${ROLE_LABEL[previewRole]}已过期` : `暂无${ROLE_LABEL[previewRole]}预览`}
              </EmptyTitle>
              <EmptyDescription>
                {track.expired
                  ? `请重新生成${ROLE_LABEL[previewRole]}后再试听。`
                  : `生成成功后可在此切换并播放${ROLE_LABEL[previewRole]}。`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-secondary/40 px-5 py-5 md:px-6">
        <h2 className="text-base font-medium text-foreground">元信息 · {ROLE_LABEL[previewRole]}</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Voice</dt>
            <dd className="mt-1 text-foreground">{track.voice ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">生成时间</dt>
            <dd className="mt-1 tabular-nums text-foreground">{formatDateTime(track.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">更新时间</dt>
            <dd className="mt-1 tabular-nums text-foreground">{formatDateTime(track.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">MIME</dt>
            <dd className="mt-1 text-foreground">{track.mimeType ?? '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
