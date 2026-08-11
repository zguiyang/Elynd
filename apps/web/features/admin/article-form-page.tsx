'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  ARTICLE_BODY_MAX_WORDS,
  type ArticleLevel,
  countArticleWords,
  getPublishArticleIssues,
} from '@elynd/shared/api/articles';

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
import {
  type AdminArticle,
  adminArticlesQueryKey,
  createAdminArticle,
  formatAdminApiError,
  getAdminArticle,
  publishAdminArticle,
  unpublishAdminArticle,
  updateAdminArticle,
} from '@/features/admin/articles-api';
import { cn } from '@/lib/utils';

type ArticleFormValues = {
  title: string;
  body: string;
  level: ArticleLevel;
  themesText: string;
  sourceNote: string;
  seriesId: string;
  seriesOrder: string;
  estimatedMinutes: string;
};

type ArticleFormPageProps = {
  mode: 'create' | 'edit';
  articleId?: string;
};

const LEVEL_ITEMS = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'mid' },
  { label: '稍难', value: 'stretch' },
] as const;

function emptyFormValues(): ArticleFormValues {
  return {
    title: '',
    body: '',
    level: 'easy',
    themesText: '',
    sourceNote: '',
    seriesId: '',
    seriesOrder: '',
    estimatedMinutes: '',
  };
}

function toFormValues(article: AdminArticle): ArticleFormValues {
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

function parseThemes(themesText: string): string[] {
  return themesText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n)) {
    return null;
  }
  return n;
}

function buildPayload(values: ArticleFormValues) {
  const seriesId = values.seriesId.trim() ? values.seriesId.trim() : null;
  const seriesOrder = parseOptionalInt(values.seriesOrder);
  const estimatedMinutes = parseOptionalInt(values.estimatedMinutes);

  return {
    title: values.title.trim(),
    body: values.body,
    level: values.level,
    themes: parseThemes(values.themesText),
    sourceNote: values.sourceNote,
    seriesId,
    seriesOrder,
    estimatedMinutes,
  };
}

type ArticleFormEditorProps = {
  mode: 'create' | 'edit';
  articleId?: string;
  initialArticle: AdminArticle | null;
};

function ArticleFormEditor({ mode, articleId, initialArticle }: ArticleFormEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ArticleFormValues>(() =>
    initialArticle ? toFormValues(initialArticle) : emptyFormValues(),
  );

  const wordCount = useMemo(() => countArticleWords(values.body), [values.body]);
  const themes = parseThemes(values.themesText);
  const estimatedMinutes = parseOptionalInt(values.estimatedMinutes);
  const isOverWordCap = wordCount > ARTICLE_BODY_MAX_WORDS;

  const invalidateArticles = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: adminArticlesQueryKey.all });
    if (id) {
      await queryClient.invalidateQueries({ queryKey: adminArticlesQueryKey.detail(id) });
    }
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(values);
      if (!payload.title) {
        throw new Error('请填写标题');
      }
      if (payload.seriesOrder != null && payload.seriesId == null) {
        throw new Error('填写系列顺序时需要同时填写系列 ID');
      }

      if (mode === 'create') {
        return createAdminArticle(payload);
      }
      if (!articleId) {
        throw new Error('缺少文章 ID');
      }
      return updateAdminArticle(articleId, payload);
    },
    onSuccess: async (article) => {
      await invalidateArticles(article.id);
      toast.success('草稿已保存');
      if (mode === 'create') {
        router.replace(ADMIN_ROUTES.articleEdit(article.id));
      } else {
        setValues(toFormValues(article));
      }
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(values);
      if (!payload.title) {
        throw new Error('请填写标题');
      }
      if (payload.seriesOrder != null && payload.seriesId == null) {
        throw new Error('填写系列顺序时需要同时填写系列 ID');
      }

      const issues = getPublishArticleIssues(payload);
      if (issues.length > 0) {
        throw new Error(issues.map((issue) => issue.message).join('；'));
      }

      let article: AdminArticle;
      if (mode === 'create') {
        article = await createAdminArticle(payload);
      } else {
        if (!articleId) {
          throw new Error('缺少文章 ID');
        }
        article = await updateAdminArticle(articleId, payload);
      }
      return publishAdminArticle(article.id);
    },
    onSuccess: async (article) => {
      await invalidateArticles(article.id);
      toast.success('已发布');
      if (mode === 'create') {
        router.replace(ADMIN_ROUTES.articleEdit(article.id));
      } else {
        setValues(toFormValues(article));
      }
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!articleId) {
        throw new Error('缺少文章 ID');
      }
      const payload = buildPayload(values);
      if (!payload.title) {
        throw new Error('请填写标题');
      }
      await updateAdminArticle(articleId, payload);
      return unpublishAdminArticle(articleId);
    },
    onSuccess: async (article) => {
      await invalidateArticles(article.id);
      toast.success('已下架');
      setValues(toFormValues(article));
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  function updateField<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const heading = mode === 'create' ? '新建文章' : '编辑文章';
  const isBusy = saveDraftMutation.isPending || publishMutation.isPending || unpublishMutation.isPending;

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
                    disabled={isBusy}
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
                    disabled={isBusy}
                  />
                  <FieldDescription className={cn(isOverWordCap && 'text-destructive')}>
                    约 {wordCount} 词（发布上限 {ARTICLE_BODY_MAX_WORDS}）
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
                        updateField('level', value as ArticleLevel);
                      }}
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                    disabled={isBusy}
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
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                disabled={isBusy}
                onClick={() => saveDraftMutation.mutate()}
              >
                {saveDraftMutation.isPending ? '保存中…' : '存草稿'}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl px-6 hover:bg-brand-deep"
                disabled={isBusy}
                onClick={() => publishMutation.mutate()}
              >
                {publishMutation.isPending ? '发布中…' : '发布'}
              </Button>
              {mode === 'edit' ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 rounded-xl px-6"
                  disabled={isBusy}
                  onClick={() => unpublishMutation.mutate()}
                >
                  {unpublishMutation.isPending ? '下架中…' : '下架'}
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
            estimatedMinutes={estimatedMinutes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ArticleFormPage({ mode, articleId }: ArticleFormPageProps) {
  const detailQuery = useQuery({
    queryKey: adminArticlesQueryKey.detail(articleId ?? ''),
    queryFn: ({ signal }) => getAdminArticle(articleId!, { signal }),
    enabled: mode === 'edit' && Boolean(articleId),
  });

  if (mode === 'create') {
    return <ArticleFormEditor mode="create" initialArticle={null} />;
  }

  if (detailQuery.isPending) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="h-auto px-0 text-muted-foreground transition-colors duration-300 ease-out-soft hover:bg-transparent hover:text-foreground"
          render={<Link href={ADMIN_ROUTES.articles} />}
        >
          ← 返回列表
        </Button>
        <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight">无法加载文章</h1>
        <p className="mt-3 text-sm text-muted-foreground">{formatAdminApiError(detailQuery.error)}</p>
      </div>
    );
  }

  return <ArticleFormEditor mode="edit" articleId={articleId} initialArticle={detailQuery.data} />;
}
