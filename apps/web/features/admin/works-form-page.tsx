'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  DIFFICULTY_SCORE_MAX,
  DIFFICULTY_SCORE_MIN,
  difficultyLabelFromScore,
} from '@gloaming/shared/api/reading-stats';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_ROUTES } from '@/constants';
import { MetadataStatusCard } from '@/features/admin/metadata-review-panel';
import { TaxonomyMultiPicker, TaxonomySelect } from '@/features/admin/taxonomy-picker';
import {
  formatWorksApiError,
  updateAdminWork,
  useAdminWorkQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';
import type { AdminWorkView } from '@/features/works-http';

const STATUS_LABEL: Record<AdminWorkView['status'], string> = {
  uploaded: '待解析',
  processing: '解析中…',
  parsed: '待完善原数据',
  metadata: '原数据完善中…',
  tts: '音频生成中…',
  ready: '已完成',
  failed: '处理失败',
  published: '已发布',
};

function WorksFormEditor({ workId, work }: { workId: string; work: AdminWorkView }) {
  const invalidate = useInvalidateAdminWorks();
  const [title, setTitle] = useState(work.title);
  const [author, setAuthor] = useState(work.author);
  const [description, setDescription] = useState(work.description);
  const [tags, setTags] = useState<string[]>(work.tags);
  const [sources, setSources] = useState<string[]>(work.sources);
  const [category, setCategory] = useState<string | null>(work.category);
  const [suggestedVocabSize, setSuggestedVocabSize] = useState(
    work.suggestedVocabSize != null ? String(work.suggestedVocabSize) : '',
  );
  const [difficultyScore, setDifficultyScore] = useState(
    work.difficultyScore != null ? String(work.difficultyScore) : '',
  );

  async function handleSave() {
    const parsedVocab = suggestedVocabSize.trim() === '' ? null : Number.parseInt(suggestedVocabSize, 10);
    const parsedDifficulty = difficultyScore.trim() === '' ? null : Number.parseInt(difficultyScore, 10);

    if (parsedVocab != null && (!Number.isFinite(parsedVocab) || parsedVocab <= 0)) {
      toast.error('建议词汇量须为正整数');
      return;
    }
    if (
      parsedDifficulty != null &&
      (!Number.isFinite(parsedDifficulty) ||
        parsedDifficulty < DIFFICULTY_SCORE_MIN ||
        parsedDifficulty > DIFFICULTY_SCORE_MAX)
    ) {
      toast.error(`难度须为 ${DIFFICULTY_SCORE_MIN}–${DIFFICULTY_SCORE_MAX} 的整数`);
      return;
    }

    try {
      await updateAdminWork(workId, {
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        tags,
        sources,
        category: category ?? '',
        suggestedVocabSize: parsedVocab,
        difficultyScore: parsedDifficulty,
      });
      await invalidate(workId);
      toast.success('已保存');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  const hasParts = work.parts.length > 0;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">编辑作品</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={work.status === 'published' ? 'secondary' : work.status === 'failed' ? 'destructive' : 'outline'}
            >
              {STATUS_LABEL[work.status]}
            </Badge>
            <span className="text-sm text-muted-foreground">{work.title}</span>
          </div>
        </div>
        <Button
          nativeButton={false}
          variant="ghost"
          render={<Link href={ADMIN_ROUTES.workDetail(workId)}>返回流程</Link>}
        />
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card px-6 py-6">
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
        <div className="space-y-2">
          <Label htmlFor="description">简介</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="作品的简短介绍，展示在发现页"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">标签（发布至少一个）</Label>
          <TaxonomyMultiPicker kind="tag" value={tags} onChange={setTags} placeholder="搜索选择标签…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类（可选）</Label>
          <TaxonomySelect value={category} onChange={setCategory} placeholder="选择分类…（留空则不分类）" allowClear />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sources">来源（发布至少一个）</Label>
          <TaxonomyMultiPicker kind="source" value={sources} onChange={setSources} placeholder="搜索选择来源…" />
        </div>

        <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
          <p className="mb-4 text-sm font-medium text-foreground">阅读统计</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">总字数（解析自动计算）</p>
              <p className="text-sm text-foreground">{work.wordCount?.toLocaleString('en-US') ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">预计阅读时间（解析自动计算）</p>
              <p className="text-sm text-foreground">
                {work.estimatedMinutes != null ? `${work.estimatedMinutes} 分钟` : '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suggestedVocabSize">建议词汇量（可手动覆盖）</Label>
              <Input
                id="suggestedVocabSize"
                inputMode="numeric"
                value={suggestedVocabSize}
                onChange={(e) => setSuggestedVocabSize(e.target.value)}
                placeholder="如 4000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficultyScore">难度 1–5（可手动覆盖）</Label>
              <Input
                id="difficultyScore"
                inputMode="numeric"
                value={difficultyScore}
                onChange={(e) => setDifficultyScore(e.target.value)}
                placeholder={`${DIFFICULTY_SCORE_MIN}–${DIFFICULTY_SCORE_MAX}`}
              />
              {difficultyScore.trim() !== '' && Number.parseInt(difficultyScore, 10) >= DIFFICULTY_SCORE_MIN ? (
                <p className="text-xs text-muted-foreground">
                  {difficultyLabelFromScore(Number.parseInt(difficultyScore, 10))}
                </p>
              ) : null}
            </div>
          </div>
          {work.statsProvenance === 'manual' ? (
            <p className="mt-3 text-xs text-muted-foreground">当前为手动覆盖；重新解析不会改写难度与建议词汇量。</p>
          ) : null}
        </div>

        {work.originKind === 'admin_epub' ? (
          <div className="space-y-2">
            <Label>原数据完善</Label>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3.5">
              <MetadataStatusCard work={work} />
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>正文（只读）</Label>
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
            {work.status === 'processing' ||
            work.status === 'metadata' ||
            work.status === 'tts' ||
            work.status === 'uploaded' ? (
              <p className="text-sm text-muted-foreground">作品处理中，正文即将更新…</p>
            ) : work.status === 'failed' ? (
              <p className="text-sm text-muted-foreground">
                处理失败：{String(work.originMeta.lastError ?? '未知错误')}。可在流程页重试。
              </p>
            ) : hasParts ? (
              <p className="text-sm text-muted-foreground">
                正文由解析生成，包含 {work.parts.length} 个章节，不可在此编辑。
                <Link
                  href={ADMIN_ROUTES.workPreview(work.id)}
                  className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
                >
                  查看预览 →
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">暂无正文内容。</p>
            )}
          </div>
        </div>

        <Button type="button" className="h-10 rounded-xl px-6 hover:bg-brand-deep" onClick={() => void handleSave()}>
          保存
        </Button>
      </div>
    </div>
  );
}

export function WorksFormPage({ workId }: { workId: string }) {
  const detailQuery = useAdminWorkQuery(workId, { enabled: Boolean(workId) });

  if (detailQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Skeleton className="mb-8 h-9 w-40 rounded-2xl" />
        <div className="space-y-6 rounded-2xl border border-border bg-card px-6 py-6">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (detailQuery.isError && !detailQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">无法加载作品：{formatWorksApiError(detailQuery.error)}</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => void detailQuery.refetch()}>
          重试
        </Button>
      </div>
    );
  }

  const work = detailQuery.data;
  if (!work) return null;

  return <WorksFormEditor key={`${work.id}:${work.updatedAt}`} workId={work.id} work={work} />;
}
