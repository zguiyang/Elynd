'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ADMIN_ROUTES } from '@/constants';
import { ArticleFormEditor } from '@/features/admin/article-form-editor';
import { adminArticlesQueryKey, formatAdminApiError, getAdminArticle } from '@/features/admin/articles-api';

type ArticleFormPageProps = {
  mode: 'create' | 'edit';
  articleId?: string;
};

/**
 * Admin article create/edit route shell — loads detail then hands off to the editor.
 */
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
