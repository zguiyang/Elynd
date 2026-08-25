'use client';

import { AudioLines, BookOpen, Check, FileText, ListTree, Send, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { type CreateEpubWorkResult, EPUB_UPLOAD_MAX_BYTES, getPublishWorkIssues } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ADMIN_ROUTES } from '@/constants';
import {
  checkEpubWorkReuse,
  deleteAdminWork,
  formatWorksApiError,
  publishAdminWork,
  reparseAdminWork,
  unpublishAdminWork,
  uploadAdminEpub,
  useAdminWorkQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';
import type { AdminWorkView } from '@/features/works-http';
import { cn } from '@/lib/utils';

const WORKFLOW_STEPS = [
  { id: 'upload', label: '上传' },
  { id: 'parse', label: '内容解析' },
  { id: 'audio', label: '音频' },
  { id: 'publish', label: '发布' },
] as const;

type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]['id'];

type StepState = 'done' | 'active' | 'todo' | 'failed' | 'na';

const STATUS_LABEL: Record<AdminWorkView['status'], string> = {
  draft: '草稿',
  processing: '解析中…',
  published: '已发布',
  failed: '解析失败',
};

const AUDIO_STATE_LABEL: Record<'missing' | 'fresh' | 'stale', string> = {
  missing: '尚未生成章节音频',
  fresh: '首章音频已就绪',
  stale: '内容已更新，音频可能过期',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateEpubFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension !== 'epub') {
    return `「${file.name}」格式暂不支持，当前仅支持 EPUB（TXT / PDF 敬请期待）`;
  }
  if (file.size > EPUB_UPLOAD_MAX_BYTES) {
    return `「${file.name}」超过 50MB 大小限制`;
  }
  return null;
}

function stepStates(work: AdminWorkView | null): Record<WorkflowStepId, StepState> {
  if (!work) {
    return { upload: 'active', parse: 'todo', audio: 'todo', publish: 'todo' };
  }
  if (work.originKind === 'admin_text') {
    return {
      upload: 'na',
      parse: 'na',
      audio: 'na',
      publish: work.status === 'published' ? 'done' : 'todo',
    };
  }
  const parseState =
    work.status === 'processing'
      ? 'active'
      : work.status === 'failed'
        ? 'failed'
        : work.originMeta.parsed
          ? 'done'
          : 'todo';
  const audioState = work.derivedFreshness.audio === 'missing' ? 'todo' : 'done';
  return {
    upload: 'done',
    parse: parseState,
    audio: audioState,
    publish: work.status === 'published' ? 'done' : 'todo',
  };
}

function StepIndicator({ states, activeLabel }: { states: Record<WorkflowStepId, StepState>; activeLabel?: string }) {
  return (
    <nav aria-label="作品处理流程" className="mb-8 flex items-center gap-1 overflow-x-auto pb-1">
      {WORKFLOW_STEPS.map((step, index) => {
        const state = states[step.id];
        const isDone = state === 'done';
        const isActive = state === 'active';
        const isFailed = state === 'failed';
        return (
          <Fragment key={step.id}>
            {index > 0 ? (
              <div className={cn('h-px w-5 shrink-0 sm:w-7', isDone ? 'bg-brand-deep/50' : 'bg-border')} />
            ) : null}
            <div
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                isActive ? 'bg-brand-soft/60 font-medium text-brand-deep' : 'text-muted-foreground',
                isDone && 'text-foreground',
                isFailed && 'text-destructive',
                state === 'na' && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isDone || isActive
                    ? 'bg-brand-deep text-white'
                    : isFailed
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isFailed ? (
                  <TriangleAlert className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              {step.label}
            </div>
          </Fragment>
        );
      })}
      {activeLabel ? <span className="ml-3 text-xs text-muted-foreground">{activeLabel}</span> : null}
    </nav>
  );
}

function EpubDropzone({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function pickFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) {
      onFile(file);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="上传 EPUB 文件"
      className={cn(
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-card px-6 py-16 text-center transition-colors duration-300 ease-out-soft',
        isDragging ? 'border-brand bg-brand-soft/40' : 'border-border hover:border-brand/60',
        disabled && 'pointer-events-none opacity-60',
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        pickFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        className="sr-only"
        onChange={(event) => pickFiles(event.target.files)}
      />
      <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft/60 text-brand-deep transition-transform duration-300 group-hover:-translate-y-0.5">
        <BookOpen className="size-6" />
      </div>
      <p className="font-heading text-base font-medium">拖拽 EPUB 到此处，或点击选择</p>
      <p className="text-sm text-muted-foreground">上传后自动解析为章节，可在流程中审查并发布</p>
    </div>
  );
}

type UploadModeProps = {
  onCreated: (created: CreateEpubWorkResult) => void;
};

function UploadMode({ onCreated }: UploadModeProps) {
  const [error, setError] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const isBusy = isHashing || isUploading;

  async function handleFile(file: File) {
    const validationError = validateEpubFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFileName(file.name);
    setIsHashing(true);
    try {
      const contentHash = await sha256File(file);
      const reuse = await checkEpubWorkReuse({ fileName: file.name, contentHash });
      if (reuse.duplicated) {
        toast.success('秒传完成');
        onCreated(reuse);
        return;
      }

      setIsUploading(true);
      try {
        const result = await uploadAdminEpub(file);
        toast.success('作品已创建');
        onCreated(result);
      } finally {
        setIsUploading(false);
      }
    } catch (uploadError) {
      setError(formatWorksApiError(uploadError));
    } finally {
      setIsHashing(false);
    }
  }

  return (
    <div>
      {isHashing ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Spinner className="size-6 text-brand" />
          <p className="font-heading text-sm font-medium">正在校验「{selectedFileName}」…</p>
          <p className="text-xs text-muted-foreground">计算文件哈希，检查是否已存在相同文件</p>
        </div>
      ) : isUploading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Spinner className="size-6 text-brand" />
          <p className="font-heading text-sm font-medium">正在上传「{selectedFileName}」…</p>
          <p className="text-xs text-muted-foreground">文件将安全存储到对象存储</p>
        </div>
      ) : (
        <div>
          <EpubDropzone onFile={(file) => void handleFile(file)} disabled={isBusy} />
          {error ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

type WorkflowModeProps = {
  workId: string;
  work: AdminWorkView;
};

function WorkflowMode({ workId, work }: WorkflowModeProps) {
  const router = useRouter();
  const invalidate = useInvalidateAdminWorks();
  const isEpub = work.originKind === 'admin_epub';
  const states = stepStates(work);

  // Poll while the content parse job is running.
  useEffect(() => {
    if (work.status !== 'processing') {
      return;
    }
    const timer = window.setInterval(() => {
      void invalidate(workId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [work.status, workId, invalidate]);

  async function handleReparse() {
    try {
      await reparseAdminWork(workId);
      await invalidate(workId);
      toast.success('已重新开始解析');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handlePublish() {
    try {
      await publishAdminWork(workId);
      await invalidate(workId);
      toast.success('已发布');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handleUnpublish() {
    try {
      await unpublishAdminWork(workId);
      await invalidate(workId);
      toast.success('已下架');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handleDelete() {
    if (!window.confirm('确定删除此作品？删除后无法恢复。')) return;
    try {
      await deleteAdminWork(workId);
      toast.success('已删除');
      router.replace(ADMIN_ROUTES.works);
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  const parsed = isEpub ? (work.originMeta.parsed as Record<string, unknown> | undefined) : undefined;
  const publishIssues = getPublishWorkIssues({
    title: work.title,
    sourceNote: work.sourceNote,
    tags: work.tags,
    parts: work.parts.map((part) => ({ body: part.body })),
  });
  const canReparse = isEpub && work.status !== 'published' && work.status !== 'processing';
  const hasParts = work.parts.length > 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{work.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={work.status === 'published' ? 'secondary' : work.status === 'failed' ? 'destructive' : 'outline'}
            >
              {STATUS_LABEL[work.status]}
            </Badge>
            {work.author ? <span className="text-sm text-muted-foreground">{work.author}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={ADMIN_ROUTES.workEdit(work.id)} />}
          >
            编辑元数据
          </Button>
          {hasParts ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={ADMIN_ROUTES.workPreview(work.id)} />}
            >
              预览作品
            </Button>
          ) : null}
          {work.status !== 'published' ? (
            <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete()}>
              删除
            </Button>
          ) : null}
        </div>
      </div>

      <StepIndicator states={states} />

      <div className="space-y-6">
        {/* Step 1 — upload */}
        <section className="rounded-2xl border border-border bg-card px-6 py-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft/60 text-brand-deep">
              <BookOpen className="size-3.5" />
            </span>
            上传
            {states.upload === 'done' ? <Check className="size-4 text-brand-deep" /> : null}
          </h2>
          {isEpub ? (
            work.originAsset ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">文件名</dt>
                  <dd className="mt-0.5 truncate font-medium">{work.originAsset.fileName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">大小</dt>
                  <dd className="mt-0.5 font-medium">{formatFileSize(work.originAsset.size)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">文件哈希</dt>
                  <dd className="mt-0.5 font-mono text-xs">{work.originAsset.contentHash.slice(0, 12)}…</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">来源</dt>
                  <dd className="mt-0.5">
                    {work.originAsset.reused ? <Badge variant="secondary">秒传复用</Badge> : '本次上传'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">等待文件信息…</p>
            )
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">文本作品（内部种子），无源文件。</p>
          )}
        </section>

        {/* Step 2 — parse */}
        <section className="rounded-2xl border border-border bg-card px-6 py-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft/60 text-brand-deep">
              <Sparkles className="size-3.5" />
            </span>
            内容解析
            {states.parse === 'done' ? <Check className="size-4 text-brand-deep" /> : null}
          </h2>

          {!isEpub ? (
            <p className="mt-4 text-sm text-muted-foreground">文本作品不经过 EPUB 解析。</p>
          ) : work.status === 'processing' ? (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Spinner className="size-4 text-brand" />
              作品解析中，章节内容即将生成…
            </div>
          ) : work.status === 'failed' ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p>{String(work.originMeta.lastError ?? '解析失败，未知错误')}</p>
              </div>
              <Button type="button" size="sm" onClick={() => void handleReparse()}>
                重新解析
              </Button>
            </div>
          ) : parsed ? (
            <div className="mt-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">章节数</dt>
                  <dd className="mt-0.5 font-medium">{String(parsed.chapterCount ?? work.parts.length)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">图片数</dt>
                  <dd className="mt-0.5 font-medium">{String(parsed.imageCount ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">原始条目（spine）</dt>
                  <dd className="mt-0.5 font-medium">{String(parsed.spineCount ?? '—')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">目录条目（nav）</dt>
                  <dd className="mt-0.5 font-medium">{String(parsed.navCount ?? '—')}</dd>
                </div>
              </dl>
              {work.status === 'published' ? (
                <p className="mt-4 text-xs text-muted-foreground">作品已发布，如需重新解析请先下架。</p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleReparse()}
                    disabled={!canReparse}
                  >
                    重新解析
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={ADMIN_ROUTES.workPreview(work.id)} />}
                  >
                    <ListTree data-icon="inline-start" />
                    预览作品
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">等待解析…</p>
          )}
        </section>

        {/* Step 3 — audio */}
        <section className="rounded-2xl border border-border bg-card px-6 py-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft/60 text-brand-deep">
              <AudioLines className="size-3.5" />
            </span>
            音频
            {states.audio === 'done' ? <Check className="size-4 text-brand-deep" /> : null}
          </h2>
          {!isEpub ? (
            <p className="mt-4 text-sm text-muted-foreground">文本作品不参与音频流程。</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{AUDIO_STATE_LABEL[work.derivedFreshness.audio]}</span>
              <span className="text-xs">（基于首章检测）</span>
              <Badge variant="outline">生成功能即将上线</Badge>
            </div>
          )}
        </section>

        {/* Step 4 — publish */}
        <section className="rounded-2xl border border-border bg-card px-6 py-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft/60 text-brand-deep">
              <Send className="size-3.5" />
            </span>
            发布
            {states.publish === 'done' ? <Check className="size-4 text-brand-deep" /> : null}
          </h2>
          <div className="mt-4">
            <ul className="space-y-2 text-sm">
              {[
                { ok: Boolean(work.title.trim()), label: '标题已填写' },
                { ok: Boolean(work.sourceNote.trim()), label: '来源说明已填写' },
                { ok: work.tags.length >= 1, label: '至少一个标签' },
                { ok: work.parts.some((part) => part.body.trim()), label: '正文内容存在' },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.ok ? (
                    <Check className="size-4 text-brand-deep" />
                  ) : (
                    <TriangleAlert className="size-4 text-destructive" />
                  )}
                  <span className={item.ok ? '' : 'text-destructive'}>{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {work.status === 'published' ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => void handleUnpublish()}>
                  下架
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handlePublish()}
                  disabled={work.status === 'processing' || publishIssues.length > 0}
                >
                  发布
                </Button>
              )}
              {publishIssues.length > 0 && work.status !== 'published' ? (
                <span className="text-xs text-muted-foreground">完善左侧要求后即可发布</span>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type WorksWorkflowPageProps = {
  workId?: string;
};

export function WorksWorkflowPage({ workId }: WorksWorkflowPageProps) {
  const router = useRouter();
  const detailQuery = useAdminWorkQuery(workId ?? '', { enabled: Boolean(workId) });

  function handleCreated(created: CreateEpubWorkResult) {
    router.replace(ADMIN_ROUTES.workDetail(created.id));
  }

  if (workId && detailQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 h-9 w-64 animate-pulse rounded-2xl bg-surface-container-high" />
        <div className="space-y-6">
          <div className="h-28 animate-pulse rounded-2xl bg-surface-container-high" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-high" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (workId && detailQuery.isError && !detailQuery.data) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">无法加载作品详情：{formatWorksApiError(detailQuery.error)}</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => void detailQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const work = workId ? (detailQuery.data ?? null) : null;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-4xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        {!work ? <h1 className="font-heading text-3xl font-bold tracking-tight">上传作品</h1> : null}
        <Button nativeButton={false} variant="ghost" render={<Link href={ADMIN_ROUTES.works}>返回列表</Link>} />
      </div>

      {!work ? (
        <>
          <StepIndicator states={stepStates(null)} />
          <p className="-mt-4 mb-6 text-sm text-muted-foreground">
            上传 EPUB 后将自动解析为章节，可在流程中审查内容并发布到发现。
          </p>
          <div className="rounded-2xl border border-border bg-card px-6 py-8">
            <UploadMode onCreated={handleCreated} />
          </div>
        </>
      ) : (
        <WorkflowMode workId={work.id} work={work} />
      )}
    </div>
  );
}
