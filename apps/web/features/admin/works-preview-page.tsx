'use client';

import DOMPurify from 'dompurify';
import { BookOpen, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants';
import { formatWorksApiError, useAdminWorkQuery } from '@/features/admin/works-api';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<'draft' | 'processing' | 'published' | 'failed', string> = {
  draft: '草稿',
  processing: '解析中…',
  published: '已发布',
  failed: '解析失败',
};

/** Rewrite learner image proxy URLs to the admin proxy (drafts are not published yet). */
function rewriteImageSrcs(html: string): string {
  return html.split('/api/reader/assets/').join('/api/admin/assets/');
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-xl bg-muted/70" />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card px-6 py-10 md:px-12">
        <Skeleton className="mx-auto h-8 w-2/3 max-w-sm" />
        <Skeleton className="mx-auto mt-4 h-px w-12" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5" style={{ width: `${92 - (i % 3) * 10}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorksPreviewPage({ workId }: { workId: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const detailQuery = useAdminWorkQuery(workId);

  if (detailQuery.isPending) {
    return <PreviewSkeleton />;
  }

  if (detailQuery.isError && !detailQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">无法加载作品：{formatWorksApiError(detailQuery.error)}</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => void detailQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const work = detailQuery.data;
  const parsed =
    work.originKind === 'admin_epub' ? (work.originMeta.parsed as Record<string, unknown> | undefined) : undefined;
  const parts = work.parts;
  const current = parts[Math.min(selectedIndex, Math.max(0, parts.length - 1))];

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{work.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge
              variant={work.status === 'published' ? 'secondary' : work.status === 'failed' ? 'destructive' : 'outline'}
            >
              {STATUS_LABEL[work.status]}
            </Badge>
            <span>章节 {parts.length}</span>
            {parsed ? (
              <>
                <span>·</span>
                <span>图片 {String(parsed.imageCount ?? 0)}</span>
                <span>·</span>
                <span>spine {String(parsed.spineCount ?? '—')}</span>
                <span>·</span>
                <span>nav {String(parsed.navCount ?? '—')}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={ADMIN_ROUTES.workDetail(work.id)} />}
          >
            返回流程
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={ADMIN_ROUTES.workEdit(work.id)} />}
          >
            编辑元数据
          </Button>
        </div>
      </div>

      {parts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-heading text-base font-medium">
            {work.status === 'failed'
              ? '解析失败，无内容可预览'
              : work.status === 'processing'
                ? '作品解析中，章节即将生成…'
                : '暂无章节内容'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {work.status === 'failed'
              ? String(work.originMeta.lastError ?? '未知错误')
              : '完成解析后即可在此审查章节内容。'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            nativeButton={false}
            render={<Link href={ADMIN_ROUTES.workDetail(work.id)} />}
          >
            返回流程
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <nav aria-label="章节列表" className="flex flex-col gap-1.5">
            {parts.map((part, index) => (
              <button
                key={part.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-current={index === selectedIndex ? 'true' : undefined}
                className={cn(
                  'flex items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  index === selectedIndex
                    ? 'bg-brand-soft/60 font-medium text-brand-deep'
                    : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 break-words">{part.title || `章节 ${index + 1}`}</span>
              </button>
            ))}
          </nav>

          <article className="rounded-2xl border border-border bg-card px-6 py-10 md:px-12">
            {current ? (
              <>
                <header className="mb-10 text-center">
                  <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    {current.title || `章节 ${current.sortOrder + 1}`}
                  </h2>
                  <div className="mt-5 h-px w-12 bg-outline/50" aria-hidden />
                </header>
                <div
                  className="reading-body font-reading flex flex-col gap-8 text-foreground/90 text-pretty"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rewriteImageSrcs(current.body)) }}
                />
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground">请选择章节</p>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
