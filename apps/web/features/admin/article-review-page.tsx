'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import {
  type AdminReviewDraftItem,
  adminReviewQueryKey,
  formatAdminApiError,
  generateAdminReviewItems,
  getAdminReviewItems,
  replaceAdminReviewItems,
  toReviewDraftItems,
} from '@/features/admin/article-review-api';
import {
  ArticleReviewGeneratePanel,
  ArticleReviewPreviewPanel,
  ArticleReviewReviewPanel,
} from '@/features/admin/article-review-panels';
import { adminArticlesQueryKey, getAdminArticle } from '@/features/admin/articles-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

type ArticleReviewPageProps = {
  articleId: string;
};

/**
 * Admin review bank workspace: generate → preview → review → PUT replace.
 */
export function ArticleReviewPage({ articleId }: ArticleReviewPageProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('generate');
  const [draftOverride, setDraftOverride] = useState<AdminReviewDraftItem[] | null>(null);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isArticleExpanded, setIsArticleExpanded] = useState(false);

  const articleQuery = useQuery({
    queryKey: adminArticlesQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticle(articleId, { signal }),
  });

  const bankQuery = useQuery({
    queryKey: adminReviewQueryKey.items(articleId),
    queryFn: ({ signal }) => getAdminReviewItems(articleId, { signal }),
  });

  const storedDrafts = bankQuery.data ? toReviewDraftItems(bankQuery.data) : [];
  const draftItems = draftOverride ?? storedDrafts;
  const isDraftDirty = draftOverride !== null;

  const generateMutation = useMutation({
    mutationFn: () => generateAdminReviewItems(articleId),
    onSuccess: (data) => {
      setDraftOverride(data.items);
      setTab('preview');
      toast.success(`已生成 ${data.items.length} 道草稿题`);
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      replaceAdminReviewItems(articleId, {
        items: draftItems.map((item, index) => ({
          ...item,
          sortOrder: index + 1,
        })),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: adminReviewQueryKey.items(articleId) });
      setDraftOverride(null);
      setIsSaveOpen(false);
      toast.success(data.items.length === 0 ? '已清空复习题' : `已入库 ${data.items.length} 道题`);
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  const article = articleQuery.data;
  const storedCount = bankQuery.data?.items.length ?? 0;
  const isNotFound = articleQuery.error instanceof ApiRequestError && articleQuery.error.status === 404;

  if (articleQuery.isPending) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  if (isNotFound || !article) {
    return (
      <Empty className="border border-dashed border-border bg-card/50 py-16">
        <EmptyHeader>
          <EmptyTitle>找不到文章</EmptyTitle>
          <EmptyDescription>{formatAdminApiError(articleQuery.error ?? new Error('缺失'))}</EmptyDescription>
        </EmptyHeader>
        <Button nativeButton={false} className="mt-6 rounded-xl" render={<Link href={ADMIN_ROUTES.articles} />}>
          返回列表
        </Button>
      </Empty>
    );
  }

  const paragraphs = paragraphsFromBody(article.body);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-5xl pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          render={<Link href={ADMIN_ROUTES.articleEdit(articleId)} />}
        >
          ← 返回编辑
        </Button>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          render={<Link href={ADMIN_ROUTES.articles} />}
        >
          列表
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">{article.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            复习题工作台 · {LEVEL_LABEL[article.level]} · {article.status === 'published' ? '文章已发布' : '文章草稿'}
          </p>
        </div>
        <Badge variant={storedCount > 0 ? 'secondary' : 'outline'}>
          {isDraftDirty ? `草稿 ${draftItems.length} 题（未入库）` : `已入库 ${storedCount} 题`}
        </Badge>
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-secondary/50 px-5 py-4 md:px-6">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground"
          onClick={() => setIsArticleExpanded((prev) => !prev)}
        >
          <span>短文摘要</span>
          <span className="text-muted-foreground">{isArticleExpanded ? '收起' : '展开'}</span>
        </button>
        {isArticleExpanded ? (
          <div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.body}</p>
        )}
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value != null) {
            setTab(value);
          }
        }}
        className="mt-8"
      >
        <AdminSegmentedTabsList aria-label="复习题步骤">
          <AdminSegmentedTabsTrigger value="generate">生成</AdminSegmentedTabsTrigger>
          <AdminSegmentedTabsTrigger value="preview">预览</AdminSegmentedTabsTrigger>
          <AdminSegmentedTabsTrigger value="review">审查</AdminSegmentedTabsTrigger>
        </AdminSegmentedTabsList>

        <TabsContent value="generate" className="mt-6">
          <ArticleReviewGeneratePanel
            level={article.level}
            isGenerating={generateMutation.isPending}
            hasDraft={draftItems.length > 0}
            onGenerate={() => generateMutation.mutate()}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <ArticleReviewPreviewPanel items={draftItems} />
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          <ArticleReviewReviewPanel
            items={draftItems}
            onChange={(next) => {
              setDraftOverride(next);
            }}
          />
        </TabsContent>
      </Tabs>

      <footer
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-sidebar/95 backdrop-blur-sm',
          'px-4 py-4 md:px-8',
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={!isDraftDirty || bankQuery.isPending}
            onClick={() => {
              setDraftOverride(null);
              toast.message('已恢复为已入库题目');
            }}
          >
            放弃草稿
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            disabled={saveMutation.isPending}
            onClick={() => setIsSaveOpen(true)}
          >
            保存并替换入库
          </Button>
        </div>
      </footer>

      <AlertDialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存并替换复习题？</AlertDialogTitle>
            <AlertDialogDescription>
              将用当前草稿（{draftItems.length}{' '}
              题）全量替换线上复习题库。已物化进今日队列的快照仍保留。空草稿会清空题库。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '保存中…' : '确认保存'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
