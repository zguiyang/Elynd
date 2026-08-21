'use client';

import { FileTextIcon } from 'lucide-react';

import { type ArticleLevel } from '@gloaming/shared/api/articles';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';

type ArticlePreviewPanelProps = {
  title: string;
  body: string;
  level?: ArticleLevel;
  themes?: string[];
  estimatedMinutes?: number | null;
};

export function ArticlePreviewPanel({ title, body, level, themes = [], estimatedMinutes }: ArticlePreviewPanelProps) {
  const paragraphs = paragraphsFromBody(body);
  const levelLabel = level ? LEVEL_LABEL[level] : null;
  const metaParts = [
    levelLabel,
    themes.length > 0 ? themes.join(' · ') : null,
    estimatedMinutes != null ? `约 ${estimatedMinutes} 分钟` : null,
  ].filter(Boolean);

  return (
    <Card className="mx-auto max-w-[42rem] gap-0 rounded-3xl border border-border bg-card py-0 shadow-none ring-0">
      <CardHeader className="gap-3 px-6 pt-9 pb-0 md:px-10 md:pt-11">
        {metaParts.length > 0 ? <p className="text-sm tracking-wide text-brand-deep">{metaParts.join(' · ')}</p> : null}
        <CardTitle className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title.trim() || '未命名标题'}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pt-8 pb-9 md:px-10 md:pb-11">
        {paragraphs.length > 0 ? (
          <div className="font-reading flex max-w-[65ch] flex-col gap-5 text-base leading-relaxed text-foreground">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <Empty className="border-0 p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>暂无正文</EmptyTitle>
              <EmptyDescription>请先在「编辑」中填写正文，再预览阅读效果。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
