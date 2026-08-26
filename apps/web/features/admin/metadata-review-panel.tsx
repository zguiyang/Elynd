'use client';

import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { MetadataEnrichmentStatus, UpdateWorkBody, WorkMetadataProvenance } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatWorksApiError, updateAdminWork, useInvalidateAdminWorks } from '@/features/admin/works-api';
import type { AdminWorkView } from '@/features/works-http';
import { cn } from '@/lib/utils';

const ENRICH_STATUS_LABEL: Record<MetadataEnrichmentStatus, string> = {
  pending: '待回填',
  running: '回填中',
  completed: '已完成',
  failed: '回填失败',
  skipped: '已跳过',
};

const PROVENANCE_LABEL: Record<WorkMetadataProvenance, string> = {
  extracted: '提取',
  ai: 'AI 生成',
  manual: '人工',
};

/** Secondary source badges — the ember accent stays reserved for busy/active states. */
function ProvenanceBadge({ provenance }: { provenance?: WorkMetadataProvenance }) {
  if (!provenance) {
    return null;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        provenance === 'ai' && 'border-transparent bg-brand-soft text-brand-deep',
        provenance === 'manual' && 'border-transparent bg-secondary text-secondary-foreground',
        provenance === 'extracted' && 'text-muted-foreground',
      )}
    >
      {PROVENANCE_LABEL[provenance]}
    </Badge>
  );
}

type MetadataFieldRowProps = {
  label: string;
  /** Display value (fallback text when empty). */
  value: string;
  /** Initial edit text — defaults to the display value. */
  editValue?: string;
  multiline?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  provenance?: WorkMetadataProvenance;
  disabled?: boolean;
  onSave: (value: string) => Promise<void>;
};

/**
 * One metadata row in the review panel — display state (value + source badge)
 * toggles into an inline edit form; saving goes through the normal work PATCH
 * (provenance becomes `manual`), and the row re-reads the freshest value.
 */
function MetadataFieldRow({
  label,
  value,
  editValue,
  multiline,
  required,
  maxLength,
  placeholder,
  provenance,
  disabled,
  onSave,
}: MetadataFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setDraft(editValue ?? value);
    setError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    const text = draft.trim();
    if (required && !text) {
      setError('此字段必填');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(text);
      setIsEditing(false);
    } catch (saveError) {
      setError(formatWorksApiError(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <div className="py-3.5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>
              {label}
              {required ? <span className="ml-0.5 text-destructive">*</span> : null}
            </Label>
            <ProvenanceBadge provenance={provenance} />
          </div>
          {multiline ? (
            <Textarea
              value={draft}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <Input
              value={draft}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? '保存中…' : '保存'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
              取消
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <ProvenanceBadge provenance={provenance} />
        </div>
        <p className={cn('mt-1 truncate text-sm', !value && 'text-muted-foreground')}>{value || '未填写'}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={startEdit} disabled={disabled}>
        <Pencil data-icon="inline-start" />
        编辑
      </Button>
    </div>
  );
}

function splitList(text: string): string[] {
  return text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

type MetadataReviewPanelProps = {
  workId: string;
  work: AdminWorkView;
};

/**
 * "信息回填" step — shows the AI backfill outcome field-by-field with source
 * badges, lets the admin edit in place, and the publish action submits whatever
 * the rows hold at that moment.
 */
export function MetadataReviewPanel({ workId, work }: MetadataReviewPanelProps) {
  const invalidate = useInvalidateAdminWorks();
  const status = work.metadataEnrichmentStatus;
  const isBusy = status === 'running' || work.status === 'processing';

  async function saveField(patch: UpdateWorkBody) {
    await updateAdminWork(workId, patch);
    await invalidate(workId);
    toast.success('已保存');
  }

  const hint =
    status === 'pending'
      ? '解析完成后，AI 将自动补全缺失的简介、标签与分类。'
      : status === 'running'
        ? 'AI 正在根据正文内容补全信息，完成后即可逐项核对。'
        : status === 'failed'
          ? '回填失败，可在内容解析步骤重新解析以重试。'
          : status === 'skipped'
            ? '未配置回填模型，已跳过自动生成；可在此手动完善。'
            : 'AI 已自动补全缺失信息，可逐项核对编辑；发布时以当前内容为准。';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'running' ? <Spinner className="size-4 text-brand" /> : null}
        <Badge variant={status === 'completed' ? 'secondary' : 'outline'}>{ENRICH_STATUS_LABEL[status]}</Badge>
        {status === 'completed' && work.metadataEnrichmentAt ? (
          <span className="text-xs text-muted-foreground">
            回填于 {new Date(work.metadataEnrichmentAt).toLocaleString('zh-CN')}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>

      {status === 'running' ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-background/40 px-4">
          <MetadataFieldRow
            label="标题"
            value={work.title}
            required
            maxLength={200}
            disabled={isBusy}
            onSave={(value) => saveField({ title: value })}
          />
          <MetadataFieldRow
            label="作者"
            value={work.author}
            maxLength={200}
            placeholder="可留空"
            disabled={isBusy}
            onSave={(value) => saveField({ author: value })}
          />
          <MetadataFieldRow
            label="简介"
            value={work.description}
            multiline
            maxLength={2000}
            placeholder="作品的简短介绍，展示在发现页"
            provenance={work.metadataProvenance.description}
            disabled={isBusy}
            onSave={(value) => saveField({ description: value })}
          />
          <MetadataFieldRow
            label="标签"
            value={work.tags.length > 0 ? work.tags.join(' · ') : ''}
            editValue={work.tags.join(', ')}
            placeholder="用逗号分隔，发布至少一个"
            provenance={work.metadataProvenance.tags}
            disabled={isBusy}
            onSave={(value) => saveField({ tags: splitList(value) })}
          />
          <MetadataFieldRow
            label="分类"
            value={work.category ?? ''}
            maxLength={100}
            placeholder="留空则不分类"
            provenance={work.metadataProvenance.category}
            disabled={isBusy}
            onSave={(value) => saveField({ category: value })}
          />
          <MetadataFieldRow
            label="来源"
            value={work.sources.length > 0 ? work.sources.join(' · ') : ''}
            editValue={work.sources.join(', ')}
            placeholder="用逗号分隔，如 Project Gutenberg"
            disabled={isBusy}
            onSave={(value) => saveField({ sources: splitList(value) })}
          />
        </div>
      )}
    </div>
  );
}
