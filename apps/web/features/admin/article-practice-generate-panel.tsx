'use client';

import type { ArticleLevel } from '@gloaming/shared/api/articles';

import { Button } from '@/components/ui/button';
import { LEVEL_LABEL } from '@/features/library/library-model';

type ArticlePracticeGeneratePanelProps = {
  level: ArticleLevel;
  isGenerating: boolean;
  hasDraft: boolean;
  onGenerate: () => void;
};

/**
 * Admin step: AI generate draft practice items from article body + level.
 */
export function ArticlePracticeGeneratePanel({
  level,
  isGenerating,
  hasDraft,
  onGenerate,
}: ArticlePracticeGeneratePanelProps) {
  return (
    <section className="rounded-3xl border border-border bg-card px-6 py-7 md:px-8 md:py-9">
      <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">生成</p>
      <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight">根据正文出题</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        使用文章正文与难度（{LEVEL_LABEL[level]}
        ）按学习维度出题：词汇语境、句型/句子理解、短文大意等。题干与选项用中文（词汇保留英文词与原文引用），验证真实理解而非读题能力；题量以覆盖为准，不凑固定题数。结果先进入本页草稿，审查后再保存入库；不会自动写入数据库。
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-11 rounded-xl px-6 hover:bg-brand-deep"
          disabled={isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? '生成中…' : hasDraft ? '重新生成草稿' : '根据正文生成'}
        </Button>
        {hasDraft ? <p className="text-sm text-muted-foreground">已有草稿，可到「预览 / 审查」查看或修改。</p> : null}
      </div>
    </section>
  );
}
