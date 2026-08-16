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
  type AdminPracticeDraftItem,
  adminPracticeQueryKey,
  formatAdminApiError,
  generateAdminPracticeItems,
  getAdminPracticeItems,
  replaceAdminPracticeItems,
  toDraftItems,
} from '@/features/admin/article-practice-api';
import { ArticlePracticeGeneratePanel } from '@/features/admin/article-practice-generate-panel';
import { ArticlePracticePreviewPanel } from '@/features/admin/article-practice-preview-panel';
import { ArticlePracticeReviewPanel } from '@/features/admin/article-practice-review-panel';
import { adminArticlesQueryKey, getAdminArticle } from '@/features/admin/articles-api';
import { LEVEL_LABEL, paragraphsFromBody } from '@/features/library/library-model';
import { ApiRequestError } from '@/lib/api-request';
import { cn } from '@/lib/utils';

type ArticlePracticePageProps = {
  articleId: string;
};

/**
 * Admin practice workspace: generate → preview → review → PUT replace.
 */
export function ArticlePracticePage({ articleId }: ArticlePracticePageProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('generate');
  const [draftOverride, setDraftOverride] = useState<AdminPracticeDraftItem[] | null>(null);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isArticleExpanded, setIsArticleExpanded] = useState(false);

  const articleQuery = useQuery({
    queryKey: adminArticlesQueryKey.detail(articleId),
    queryFn: ({ signal }) => getAdminArticle(articleId, { signal }),
  });

  const practiceQuery = useQuery({
    queryKey: adminPracticeQueryKey.items(articleId),
    queryFn: ({ signal }) => getAdminPracticeItems(articleId, { signal }),
  });

  const storedDrafts = practiceQuery.data ? toDraftItems(practiceQuery.data) : [];
  const draftItems = draftOverride ?? storedDrafts;
  const isDraftDirty = draftOverride !== null;

  const generateMutation = useMutation({
    mutationFn: () => generateAdminPracticeItems(articleId),
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
      replaceAdminPracticeItems(articleId, {
        items: draftItems.map((item, index) => ({
          ...item,
          sortOrder: index + 1,
        })),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: adminPracticeQueryKey.items(articleId) });
      setDraftOverride(null);
      setIsSaveOpen(false);
      toast.success(data.items.length === 0 ? '已清空练习题' : `已入库 ${data.items.length} 道题`);
    },
    onError: (error) => {
      toast.error(formatAdminApiError(error));
    },
  });

  const article = articleQuery.data;
  const storedCount = practiceQuery.data?.items.length ?? 0;
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
            练习题工作台 · {LEVEL_LABEL[article.level]} · {article.status === 'published' ? '文章已发布' : '文章草稿'}
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
        <AdminSegmentedTabsList aria-label="练习题步骤">
          <AdminSegmentedTabsTrigger value="generate">生成</AdminSegmentedTabsTrigger>
          <AdminSegmentedTabsTrigger value="preview">预览</AdminSegmentedTabsTrigger>
          <AdminSegmentedTabsTrigger value="review">审查</AdminSegmentedTabsTrigger>
        </AdminSegmentedTabsList>

        <TabsContent value="generate" className="mt-6">
          <ArticlePracticeGeneratePanel
            level={article.level}
            isGenerating={generateMutation.isPending}
            hasDraft={draftItems.length > 0}
            onGenerate={() => generateMutation.mutate()}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <ArticlePracticePreviewPanel items={draftItems} />
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          <ArticlePracticeReviewPanel
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
            disabled={!isDraftDirty || practiceQuery.isPending}
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
            <AlertDialogTitle>保存并替换练习题？</AlertDialogTitle>
            <AlertDialogDescription>
              将用当前草稿（{draftItems.length} 题）全量替换线上练习题。已有学习者作答历史仍保留，但可能指向旧题
              ID。空草稿会清空练习。
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
