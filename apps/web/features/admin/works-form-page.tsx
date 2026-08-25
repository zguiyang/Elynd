'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ADMIN_ROUTES } from '@/constants';
import {
  createAdminTextWork,
  formatWorksApiError,
  publishAdminWork,
  updateAdminWork,
  useAdminWorkQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';
import type { AdminWorkView } from '@/features/works-http';

type WorksFormPageProps = {
  mode: 'new' | 'edit';
  workId?: string;
};

type FormValues = {
  title: string;
  author: string;
  body: string;
  sourceNote: string;
  tagsText: string;
};

function emptyFormValues(): FormValues {
  return { title: '', author: '', body: '', sourceNote: '', tagsText: '' };
}

function formValuesFromWork(work: AdminWorkView): FormValues {
  return {
    title: work.title,
    author: work.author,
    body: work.parts[0]?.body ?? '',
    sourceNote: work.sourceNote,
    tagsText: work.tags.join(', '),
  };
}

const STATUS_LABEL: Record<AdminWorkView['status'], string> = {
  draft: '草稿',
  processing: '解析中…',
  published: '已发布',
  failed: '解析失败',
  archived: '已归档',
};

type WorksFormEditorProps = {
  mode: 'new' | 'edit';
  workId?: string;
  work?: AdminWorkView;
  initial: FormValues;
};

function WorksFormEditor({ mode, workId, work, initial }: WorksFormEditorProps) {
  const router = useRouter();
  const invalidate = useInvalidateAdminWorks();
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [body, setBody] = useState(initial.body);
  const [sourceNote, setSourceNote] = useState(initial.sourceNote);
  const [tagsText, setTagsText] = useState(initial.tagsText);
  const isEpubWork = work?.originKind === 'admin_epub';

  // Poll while the EPUB ingest job is running.
  useEffect(() => {
    if (!isEpubWork || !workId || work?.status !== 'processing') {
      return;
    }
    const timer = window.setInterval(() => {
      void invalidate(workId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isEpubWork, workId, work?.status, invalidate]);

  async function handleSaveDraft() {
    try {
      const tags = tagsText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);

      if (mode === 'new') {
        const created = await createAdminTextWork({ title: title.trim(), body: body.trim() });
        if (author.trim() || tags.length || sourceNote.trim()) {
          await updateAdminWork(created.id, {
            author: author.trim(),
            tags,
            sourceNote: sourceNote.trim(),
          });
        }
        await invalidate(created.id);
        toast.success('已创建');
        router.replace(ADMIN_ROUTES.workEdit(created.id));
        return;
      }

      if (!workId || !work) return;
      await updateAdminWork(workId, {
        title: title.trim(),
        author: author.trim(),
        tags,
        sourceNote: sourceNote.trim(),
      });
      await invalidate(workId);
      toast.success('已保存');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handlePublish() {
    await handleSaveDraft();
    if (!workId) return;
    try {
      await publishAdminWork(workId);
      await invalidate(workId);
      toast.success('已发布');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{mode === 'new' ? '新建作品' : '编辑作品'}</h1>
        <Button nativeButton={false} variant="ghost" render={<Link href={ADMIN_ROUTES.works}>返回列表</Link>} />
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card px-6 py-6">
        {work?.status === 'failed' ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            解析失败：{String(work.originMeta?.lastError ?? '未知错误')}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">作者</Label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="EPUB 解析自动填充，可手动修正"
          />
        </div>
        {isEpubWork ? (
          <div className="space-y-2">
            <Label>正文（只读，由 EPUB 解析生成）</Label>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
              {work?.status === 'processing' ? (
                <p className="text-center text-sm text-muted-foreground">作品解析中，正文即将生成…</p>
              ) : work?.status === 'failed' ? (
                <p className="text-center text-sm text-muted-foreground">解析失败，请重新上传或检查文件。</p>
              ) : work?.parts.length ? (
                <div className="max-h-96 overflow-y-auto">
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                    {work.parts.map((part) => (
                      <li key={part.id}>{part.title || `章节 ${part.sortOrder + 1}`}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">{STATUS_LABEL[work?.status ?? 'draft']}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="body">正文</Label>
            <Textarea id="body" rows={16} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="sourceNote">来源说明（发布必填）</Label>
          <Input id="sourceNote" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">标签（逗号分隔，发布至少一个）</Label>
          <Input
            id="tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="story, daily-life"
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            className="h-10 rounded-xl px-6 hover:bg-brand-deep"
            onClick={() => void handleSaveDraft()}
            disabled={work?.status === 'processing'}
          >
            保存草稿
          </Button>
          {mode === 'edit' && workId && work?.parts.length ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 rounded-xl px-6"
              onClick={() => void handlePublish()}
              disabled={work?.status === 'processing'}
            >
              发布
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function WorksFormPage({ mode, workId }: WorksFormPageProps) {
  const detailQuery = useAdminWorkQuery(workId ?? '', { enabled: mode === 'edit' && Boolean(workId) });

  if (mode === 'edit' && detailQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="mb-8 h-9 w-40 rounded-2xl" />
        <div className="space-y-6 rounded-2xl border border-border bg-card px-6 py-6">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const work = detailQuery.data;
  const initial = work ? formValuesFromWork(work) : emptyFormValues();
  const formKey = work ? `${work.id}:${work.updatedAt}` : 'new';

  return <WorksFormEditor key={formKey} mode={mode} workId={workId} work={work} initial={initial} />;
}
