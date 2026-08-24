'use client';

import { AudioLines, BookOpen, Check, ListTree, type LucideIcon, Send, Sparkles, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useRef, useState } from 'react';
import { toast } from 'sonner';

import { type CreateEpubWorkResult, EPUB_UPLOAD_MAX_BYTES } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ADMIN_ROUTES } from '@/constants';
import { checkEpubWorkReuse, formatWorksApiError, uploadAdminEpub } from '@/features/admin/works-api';
import { cn } from '@/lib/utils';

const WORK_CREATION_STEPS = [
  { id: 'upload', label: '上传 EPUB' },
  { id: 'clean', label: '内容清洗' },
  { id: 'chapters', label: '目录解析' },
  { id: 'audio', label: '音频生成' },
  { id: 'publish', label: '发布' },
] as const;

const STEP_PLACEHOLDERS: Record<(typeof WORK_CREATION_STEPS)[number]['id'], { icon: LucideIcon; description: string }> =
  {
    upload: { icon: BookOpen, description: '' },
    clean: { icon: Sparkles, description: '提取正文并去除页眉页脚等无关内容，为阅读做好准备。' },
    chapters: { icon: ListTree, description: '识别章节结构，将内容切分为有序的阅读单元。' },
    audio: { icon: AudioLines, description: '为各章节生成 TTS 音频，支持试听与角色对比。' },
    publish: { icon: Send, description: '校验标题、来源与标签后，将作品发布到发现。' },
  };

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
        accept=".epub,.txt,.pdf"
        className="sr-only"
        onChange={(event) => pickFiles(event.target.files)}
      />
      <div className="flex size-12 items-center justify-center rounded-xl bg-brand-soft/60 text-brand-deep transition-transform duration-300 group-hover:-translate-y-0.5">
        <BookOpen className="size-6" />
      </div>
      <p className="font-heading text-base font-medium">拖拽 EPUB 到此处，或点击选择</p>
      <p className="text-sm text-muted-foreground">支持 EPUB / TXT / PDF</p>
    </div>
  );
}

export function WorksNewPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [created, setCreated] = useState<CreateEpubWorkResult | null>(null);
  const [isDuplicated, setIsDuplicated] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

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
        setCreated(reuse);
        setIsDuplicated(true);
        setCompletedSteps((previous) => new Set(previous).add(0));
        toast.success('秒传完成');
        return;
      }

      setIsDuplicated(false);
      setIsUploading(true);
      try {
        const result = await uploadAdminEpub(file);
        setCreated(result);
        setCompletedSteps((previous) => new Set(previous).add(0));
        toast.success('作品已创建');
      } finally {
        setIsUploading(false);
      }
    } catch (uploadError) {
      setError(formatWorksApiError(uploadError));
    } finally {
      setIsHashing(false);
    }
  }

  const activeStepId = WORK_CREATION_STEPS[activeStep]?.id ?? 'upload';
  const isBusy = isHashing || isUploading;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight">新建作品</h1>
        <Button nativeButton={false} variant="ghost" render={<Link href={ADMIN_ROUTES.works}>返回列表</Link>} />
      </div>

      <nav aria-label="新建作品流程" className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
        {WORK_CREATION_STEPS.map((step, index) => {
          const isDone = completedSteps.has(index);
          const isActive = index === activeStep;
          return (
            <Fragment key={step.id}>
              {index > 0 ? (
                <div className={cn('h-px w-5 shrink-0 sm:w-7', isDone ? 'bg-brand/50' : 'bg-border')} />
              ) : null}
              <button
                type="button"
                onClick={() => setActiveStep(index)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-brand-soft/60 font-medium text-brand-deep' : 'hover:bg-muted/60',
                  !isDone && !isActive && 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isDone || isActive ? 'bg-brand text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : index + 1}
                </span>
                {step.label}
              </button>
            </Fragment>
          );
        })}
      </nav>

      {activeStep === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-8">
          {created ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="size-5" />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                    {isDuplicated ? '秒传完成' : '上传成功'}
                    {isDuplicated ? <Badge variant="secondary">检测到相同文件</Badge> : null}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    「{String(created.originMeta.originalFileName ?? created.title)}」（
                    {formatFileSize(created.asset.size)}） 已存入对象存储，作品已创建为草稿
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  nativeButton={false}
                  className="h-10 rounded-xl px-6 hover:bg-brand-deep"
                  render={<Link href={ADMIN_ROUTES.workEdit(created.id)} />}
                >
                  编辑作品元数据
                </Button>
                <p className="text-xs text-muted-foreground">内容清洗、目录解析等后续步骤即将上线</p>
              </div>
            </div>
          ) : isHashing ? (
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
      ) : (
        <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
            {(() => {
              const placeholder = STEP_PLACEHOLDERS[activeStepId];
              const Icon = placeholder?.icon ?? BookOpen;
              return <Icon className="size-5" />;
            })()}
          </div>
          <h2 className="mt-4 font-heading text-base font-medium">{WORK_CREATION_STEPS[activeStep]?.label}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {STEP_PLACEHOLDERS[activeStepId]?.description}
          </p>
          <Badge variant="secondary" className="mt-4">
            即将上线
          </Badge>
        </div>
      )}
    </div>
  );
}
