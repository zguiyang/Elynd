'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import { ArticlePreviewPanel } from '@/features/admin/article-preview-panel';
import { emptyArticleFormValues, type MockArticle } from '@/features/admin/articles-mock-data';
import { cn } from '@/lib/utils';

type ArticleFormValues = {
  title: string;
  body: string;
  level: MockArticle['level'];
  themesText: string;
  sourceNote: string;
  seriesId: string;
  seriesOrder: string;
  estimatedMinutes: string;
};

type ArticleFormPageProps = {
  mode: 'create' | 'edit';
  initialArticle?: MockArticle;
};

const LEVEL_ITEMS = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'mid' },
  { label: '稍难', value: 'stretch' },
] as const;

function toFormValues(article: MockArticle | undefined): ArticleFormValues {
  if (!article) {
    const empty = emptyArticleFormValues();
    return {
      title: empty.title,
      body: empty.body,
      level: empty.level,
      themesText: '',
      sourceNote: empty.sourceNote,
      seriesId: '',
      seriesOrder: '',
      estimatedMinutes: '',
    };
  }

  return {
    title: article.title,
    body: article.body,
    level: article.level,
    themesText: article.themes.join(', '),
    sourceNote: article.sourceNote,
    seriesId: article.seriesId ?? '',
    seriesOrder: article.seriesOrder != null ? String(article.seriesOrder) : '',
    estimatedMinutes: article.estimatedMinutes != null ? String(article.estimatedMinutes) : '',
  };
}

function countWords(body: string): number {
  const parts = body.trim().split(/\s+/).filter(Boolean);
  return parts.length;
}

function uiOnlyToast(action: string) {
  toast.message(`${action}（仅 UI，未保存）`);
}

export function ArticleFormPage({ mode, initialArticle }: ArticleFormPageProps) {
  const [values, setValues] = useState<ArticleFormValues>(() => toFormValues(initialArticle));
  const wordCount = useMemo(() => countWords(values.body), [values.body]);
  const themes = values.themesText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const estimatedMinutes = values.estimatedMinutes.trim() ? Number(values.estimatedMinutes) : null;
  const isOverWordCap = wordCount > 300;

  function updateField<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const heading = mode === 'create' ? '新建文章' : '编辑文章';

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        className="h-auto px-0 text-muted-foreground transition-colors duration-300 ease-out-soft hover:bg-transparent hover:text-foreground"
        render={<Link href={ADMIN_ROUTES.articles} />}
      >
        ← 返回列表
      </Button>

      <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight md:text-5xl">{heading}</h1>
      <p className="mt-3 text-lg text-muted-foreground">粘贴标题与正文；预览对齐学习者纯阅读排版。</p>

      <Tabs defaultValue="edit" className="mt-10">
        <AdminSegmentedTabsList aria-label="编辑或预览">
          <AdminSegmentedTabsTrigger value="edit">编辑</AdminSegmentedTabsTrigger>
          <AdminSegmentedTabsTrigger value="preview">预览</AdminSegmentedTabsTrigger>
        </AdminSegmentedTabsList>

        <TabsContent value="edit" className="mt-6">
          <Card className="gap-0 rounded-3xl border border-border bg-card py-0 shadow-none ring-0">
            <CardContent className="px-6 py-7 md:px-10 md:py-9">
              <FieldGroup className="gap-6">
                <Field>
                  <FieldLabel htmlFor="article-title" className="text-muted-foreground">
                    标题
                  </FieldLabel>
                  <Input
                    id="article-title"
                    value={values.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="文章标题"
                    className="h-11 rounded-xl"
                  />
                </Field>

                <Field data-invalid={isOverWordCap || undefined}>
                  <FieldLabel htmlFor="article-body" className="text-muted-foreground">
                    正文
                  </FieldLabel>
                  <Textarea
                    id="article-body"
                    value={values.body}
                    onChange={(e) => updateField('body', e.target.value)}
                    placeholder="粘贴或输入文章正文…"
                    className="min-h-60 rounded-xl leading-relaxed"
                    aria-invalid={isOverWordCap || undefined}
                  />
                  <FieldDescription className={cn(isOverWordCap && 'text-destructive')}>
                    约 {wordCount} 词（上限 300）
                  </FieldDescription>
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="article-level" className="text-muted-foreground">
                      难度
                    </FieldLabel>
                    <Select
                      items={[...LEVEL_ITEMS]}
                      value={values.level}
                      onValueChange={(value) => {
                        if (value == null) {
                          return;
                        }
                        updateField('level', value as MockArticle['level']);
                      }}
                    >
                      <SelectTrigger id="article-level" className="h-11 w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {LEVEL_ITEMS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="article-themes" className="text-muted-foreground">
                      主题
                    </FieldLabel>
                    <Input
                      id="article-themes"
                      value={values.themesText}
                      onChange={(e) => updateField('themesText', e.target.value)}
                      placeholder="故事, 情景（逗号分隔）"
                      className="h-11 rounded-xl"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="article-source" className="text-muted-foreground">
                    来源说明
                  </FieldLabel>
                  <Input
                    id="article-source"
                    value={values.sourceNote}
                    onChange={(e) => updateField('sourceNote', e.target.value)}
                    placeholder="原创、改写、外部 AI 草稿等"
                    className="h-11 rounded-xl"
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-3">
                  <Field className="sm:col-span-1">
                    <FieldLabel htmlFor="article-series" className="text-muted-foreground">
                      系列 ID（可选）
                    </FieldLabel>
                    <Input
                      id="article-series"
                      value={values.seriesId}
                      onChange={(e) => updateField('seriesId', e.target.value)}
                      placeholder="同系列共用标识"
                      className="h-11 rounded-xl"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="article-order" className="text-muted-foreground">
                      系列顺序
                    </FieldLabel>
                    <Input
                      id="article-order"
                      inputMode="numeric"
                      value={values.seriesOrder}
                      onChange={(e) => updateField('seriesOrder', e.target.value)}
                      placeholder="如 1、2"
                      className="h-11 rounded-xl"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="article-minutes" className="text-muted-foreground">
                      预估时长（分钟）
                    </FieldLabel>
                    <Input
                      id="article-minutes"
                      inputMode="numeric"
                      value={values.estimatedMinutes}
                      onChange={(e) => updateField('estimatedMinutes', e.target.value)}
                      placeholder="约 5–15"
                      className="h-11 rounded-xl"
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3 border-t border-border px-6 py-5 md:px-10">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-6"
                onClick={() => uiOnlyToast('已存草稿')}
              >
                存草稿
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl px-6 hover:bg-brand-deep"
                onClick={() => uiOnlyToast('已发布')}
              >
                发布
              </Button>
              {mode === 'edit' ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 rounded-xl px-6"
                  onClick={() => uiOnlyToast('已下架')}
                >
                  下架
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <ArticlePreviewPanel
            title={values.title}
            body={values.body}
            level={values.level}
            themes={themes}
            estimatedMinutes={Number.isFinite(estimatedMinutes) ? estimatedMinutes : null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
