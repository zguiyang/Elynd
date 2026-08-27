'use client';

import { Pencil } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';

import type { MetadataEnrichmentStatus, UpdateWorkBody, WorkMetadataProvenance } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { TaxonomyMultiPicker, TaxonomySelect } from '@/features/admin/taxonomy-picker';
import {
  formatWorksApiError,
  refillAdminWork,
  updateAdminWork,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';
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

type ReviewPickerRowProps = {
  label: string;
  /** Display value (fallback text when empty). */
  displayValue: string;
  provenance?: WorkMetadataProvenance;
  disabled?: boolean;
  /** Editor rendered while editing — value flows through onChange into parent state. */
  picker: ReactNode;
  onSave: () => Promise<void>;
};

/**
 * Metadata row backed by a taxonomy picker (tags multi-select, category
 * single-select, sources multi-select). Display state mirrors MetadataFieldRow;
 * edit state renders the picker and saves through the normal work PATCH.
 */
function ReviewPickerRow({ label, displayValue, provenance, disabled, picker, onSave }: ReviewPickerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await onSave();
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
              <ProvenanceBadge provenance={provenance} />
            </Label>
          </div>
          {picker}
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
        <p className={cn('mt-1 truncate text-sm', !displayValue && 'text-muted-foreground')}>
          {displayValue || '未填写'}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)} disabled={disabled}>
        <Pencil data-icon="inline-start" />
        编辑
      </Button>
    </div>
  );
}

type MetadataReviewPanelProps = {
  workId: string;
  work: AdminWorkView;
};

/** Whether the refill retry action applies — failed/skipped, or a stalled pending claim. */
export function canRefillMetadata(status: MetadataEnrichmentStatus, workStatus: string): boolean {
  return (
    status === 'failed' ||
    status === 'skipped' ||
    (status === 'pending' && workStatus !== 'processing' && workStatus !== 'failed')
  );
}

type MetadataRefillStatusProps = {
  workId: string;
  status: MetadataEnrichmentStatus;
  /** `reading_work.status` — processing means the parse still owns the pipeline. */
  workStatus: string;
  enrichmentAt?: string | Date | null;
};

/**
 * Enrichment status line + retry action, shared by the workflow page and the
 * standalone work edit page. Retry re-runs fill → AI enrich without re-parsing.
 */
export function MetadataRefillStatus({ workId, status, workStatus, enrichmentAt }: MetadataRefillStatusProps) {
  const invalidate = useInvalidateAdminWorks();
  const isBusy = status === 'running' || workStatus === 'processing';
  const isStalledPending = status === 'pending' && workStatus !== 'processing' && workStatus !== 'failed';
  const canRefill = canRefillMetadata(status, workStatus);
  const [isRefilling, setIsRefilling] = useState(false);

  async function handleRefill() {
    if (!window.confirm('将重新运行信息回填（规则填充 + AI 补全），确定继续？')) return;
    setIsRefilling(true);
    try {
      await refillAdminWork(workId);
      await invalidate(workId);
      toast.success('已重新开始回填');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    } finally {
      setIsRefilling(false);
    }
  }

  const hint =
    status === 'pending'
      ? isStalledPending
        ? '回填任务尚未完成（可能因重试耗尽而中断），可点击「重新回填」重试。'
        : '解析完成后，AI 将自动补全缺失的简介、标签与分类。'
      : status === 'running'
        ? 'AI 正在根据正文内容补全信息，完成后即可逐项核对。'
        : status === 'failed'
          ? '回填失败，可点击「重新回填」重试。'
          : status === 'skipped'
            ? '未配置回填模型，已跳过自动生成；可点击「重新回填」重试。'
            : 'AI 已自动补全缺失信息，可逐项核对编辑；发布时以当前内容为准。';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'running' ? <Spinner className="size-4 text-brand" /> : null}
        <Badge variant={status === 'completed' ? 'secondary' : 'outline'}>{ENRICH_STATUS_LABEL[status]}</Badge>
        {status === 'completed' && enrichmentAt ? (
          <span className="text-xs text-muted-foreground">回填于 {new Date(enrichmentAt).toLocaleString('zh-CN')}</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      {canRefill ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() => void handleRefill()}
          disabled={isRefilling || isBusy}
        >
          {isRefilling ? '回填中…' : '重新回填'}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "信息回填" step — shows the AI backfill outcome field-by-field with source
 * badges, lets the admin edit in place, and the publish action submits whatever
 * the rows hold at that moment.
 */
export function MetadataReviewPanel({ workId, work }: MetadataReviewPanelProps) {
  const invalidate = useInvalidateAdminWorks();
  const status = work.metadataEnrichmentStatus;
  const isBusy = status === 'running' || work.status === 'processing';

  const [tagsDraft, setTagsDraft] = useState<string[]>(work.tags);
  const [sourcesDraft, setSourcesDraft] = useState<string[]>(work.sources);
  const [categoryDraft, setCategoryDraft] = useState<string | null>(work.category);

  async function saveField(patch: UpdateWorkBody) {
    await updateAdminWork(workId, patch);
    await invalidate(workId);
    toast.success('已保存');
  }

  return (
    <div className="mt-4">
      <MetadataRefillStatus
        workId={workId}
        status={status}
        workStatus={work.status}
        enrichmentAt={work.metadataEnrichmentAt}
      />

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
          <ReviewPickerRow
            label="标签"
            displayValue={work.tags.length > 0 ? work.tags.join(' · ') : ''}
            provenance={work.metadataProvenance.tags}
            disabled={isBusy}
            picker={
              <TaxonomyMultiPicker
                kind="tag"
                value={tagsDraft}
                onChange={setTagsDraft}
                placeholder="搜索选择标签…"
                disabled={isBusy}
              />
            }
            onSave={async () => saveField({ tags: tagsDraft })}
          />
          <ReviewPickerRow
            label="分类"
            displayValue={work.category ?? ''}
            provenance={work.metadataProvenance.category}
            disabled={isBusy}
            picker={
              <TaxonomySelect
                value={categoryDraft}
                onChange={setCategoryDraft}
                placeholder="选择分类…"
                allowClear
                disabled={isBusy}
              />
            }
            onSave={async () => saveField({ category: categoryDraft ?? '' })}
          />
          <ReviewPickerRow
            label="来源"
            displayValue={work.sources.length > 0 ? work.sources.join(' · ') : ''}
            disabled={isBusy}
            picker={
              <TaxonomyMultiPicker
                kind="source"
                value={sourcesDraft}
                onChange={setSourcesDraft}
                placeholder="搜索选择来源…（留空表示未知）"
                disabled={isBusy}
              />
            }
            onSave={async () => saveField({ sources: sourcesDraft })}
          />
        </div>
      )}
    </div>
  );
}
