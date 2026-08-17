'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { type TtsVoiceRole } from '@elynd/shared/api/tts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants';
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

type RoleValue = 'default' | TtsVoiceRole;

const ROLE_ITEMS = [
  { value: 'default', label: '默认音色' },
  { value: 'us', label: '美音' },
  { value: 'uk', label: '英音' },
] as const;

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

function statusPresentation(audio: {
  status: 'none' | 'ready' | 'failed';
  expired: boolean;
  contentStale: boolean;
  lastError: string | null;
}): { label: string; variant: 'outline' | 'secondary' | 'destructive'; detail?: string } {
  if (audio.status === 'none') {
    return { label: '未生成', variant: 'outline' };
  }
  if (audio.status === 'failed') {
    return { label: '失败', variant: 'destructive', detail: audio.lastError ?? undefined };
  }
  if (audio.expired) {
    return { label: '已过期', variant: 'outline', detail: 'Redis 中已无音频，请重新生成' };
  }
  if (audio.contentStale) {
    return { label: '原文已变更', variant: 'secondary', detail: '当前音频对应旧正文，建议重新生成' };
  }
  if (audio.lastError) {
    return { label: '就绪（上次重生成失败）', variant: 'secondary', detail: audio.lastError };
  }
  return { label: '就绪', variant: 'secondary' };
}

/**
 * Admin workspace: whole-article TTS generate / preview / regenerate.
 */
export function ArticleAudioPage({ articleId }: ArticleAudioPageProps) {
  const queryClient = useQueryClient();
  const [roleOverride, setRoleOverride] = useState<RoleValue | null>(null);

  const articleQuery = useQuery({
    queryKey: adminArticlesQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticle(articleId, { signal }),
  });

  const audioQuery = useQuery({
    queryKey: adminArticleAudioQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticleAudio(articleId, { signal }),
  });

  const generateMutation = useMutation({
    mutationFn: (selectedRole: RoleValue) =>
      generateAdminArticleAudio(articleId, {
        role: selectedRole === 'default' ? undefined : selectedRole,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(adminArticleAudioQueryKey.detail(articleId), data);
      toast.success(data.cached ? '已生成（命中合成缓存）' : '音频已生成');
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
  const role: RoleValue = roleOverride ?? (audio.role === 'us' || audio.role === 'uk' ? audio.role : 'default');
  const status = statusPresentation(audio);
  const hasGeneratedBefore = audio.status !== 'none';
  const canPreview = Boolean(audio.audioAvailable && audio.audioBase64 && audio.mimeType);

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
        <p className="mt-3 text-lg text-muted-foreground">短文音频工作台 · 整篇一条朗读音频</p>
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={status.variant}>{status.label}</Badge>
          {status.detail ? <p className="text-sm text-muted-foreground">{status.detail}</p> : null}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field className="sm:w-56">
            <FieldLabel>音色角色</FieldLabel>
            <Select
              items={[...ROLE_ITEMS]}
              value={role}
              onValueChange={(value) => {
                if (value === 'default' || value === 'us' || value === 'uk') {
                  setRoleOverride(value);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择音色" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROLE_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button
            className="h-11 rounded-xl"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate(role)}
          >
            {generateMutation.isPending ? '生成中…' : hasGeneratedBefore ? '重新生成' : '生成音频'}
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card px-5 py-5 md:px-6">
        <h2 className="text-base font-medium text-foreground">预览</h2>
        {canPreview ? (
          <audio className="mt-4 w-full" controls src={`data:${audio.mimeType};base64,${audio.audioBase64}`}>
            浏览器不支持音频播放
          </audio>
        ) : (
          <Empty className="border-0 py-10">
            <EmptyHeader>
              <EmptyTitle>{audio.expired ? '音频已过期' : '暂无预览'}</EmptyTitle>
              <EmptyDescription>
                {audio.expired ? '请重新生成后再试听。' : '生成成功后可在此播放整篇朗读。'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-secondary/40 px-5 py-5 md:px-6">
        <h2 className="text-base font-medium text-foreground">元信息</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Voice</dt>
            <dd className="mt-1 text-foreground">{audio.voice ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">生成时间</dt>
            <dd className="mt-1 tabular-nums text-foreground">{formatDateTime(audio.generatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">更新时间</dt>
            <dd className="mt-1 tabular-nums text-foreground">{formatDateTime(audio.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">MIME</dt>
            <dd className="mt-1 text-foreground">{audio.mimeType ?? '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
