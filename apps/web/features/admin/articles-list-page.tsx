'use client';

import { useQuery } from '@tanstack/react-query';
import { FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { type ArticleStatus } from '@elynd/shared/api/articles';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { ADMIN_ARTICLES_PAGE_SIZE, ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import { adminArticlesQueryKey, formatAdminApiError, listAdminArticles } from '@/features/admin/articles-api';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | ArticleStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
];

const LEVEL_LABEL: Record<string, string> = {
  easy: '简单',
  mid: '中等',
  stretch: '稍难',
};

function parseStatus(raw: string | null): StatusFilter {
  if (raw === 'draft' || raw === 'published') {
    return raw;
  }
  return 'all';
}

function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.floor(n);
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ArticlesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const page = parsePage(searchParams.get('page'));
  const listStatus = status === 'all' ? undefined : status;

  const listQuery = useQuery({
    queryKey: adminArticlesQueryKey.list(listStatus),
    queryFn: ({ signal }) => listAdminArticles(listStatus, { signal }),
  });

  const articles = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const totalPages = Math.max(1, Math.ceil(articles.length / ADMIN_ARTICLES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => articles.slice((safePage - 1) * ADMIN_ARTICLES_PAGE_SIZE, safePage * ADMIN_ARTICLES_PAGE_SIZE),
    [articles, safePage],
  );

  function replaceQuery(next: { status?: StatusFilter; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextStatus = next.status ?? status;
    const nextPage = next.page ?? safePage;

    if (nextStatus === 'all') {
      params.delete('status');
    } else {
      params.set('status', nextStatus);
    }

    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }

    const qs = params.toString();
    router.replace(qs ? `${ADMIN_ROUTES.articles}?${qs}` : ADMIN_ROUTES.articles);
  }

  const emptyTitle = articles.length === 0 && status !== 'all' ? '当前筛选下没有文章' : '还没有文章';
  const emptyDescription =
    articles.length === 0 && status !== 'all' ? '试试切换状态筛选，或新建一篇短文。' : '点「新建文章」开始粘贴内容。';

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">文章</h1>
          <p className="mt-3 text-lg text-muted-foreground">粘贴短文、存草稿，再发布到图书馆。</p>
        </div>
        <Button
          nativeButton={false}
          className="h-11 shrink-0 rounded-xl px-7 hover:bg-brand-deep"
          render={<Link href={ADMIN_ROUTES.articleNew} />}
        >
          新建文章
        </Button>
      </div>

      <div className="mt-10 flex flex-col gap-5">
        <Tabs
          value={status}
          onValueChange={(value) => {
            if (value !== 'all' && value !== 'draft' && value !== 'published') {
              return;
            }
            replaceQuery({ status: value, page: 1 });
          }}
        >
          <AdminSegmentedTabsList aria-label="按状态筛选">
            {STATUS_FILTERS.map((item) => (
              <AdminSegmentedTabsTrigger key={item.value} value={item.value}>
                {item.label}
              </AdminSegmentedTabsTrigger>
            ))}
          </AdminSegmentedTabsList>
        </Tabs>

        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          {listQuery.isPending ? (
            <p className="px-6 py-16 text-center text-sm text-muted-foreground">加载中…</p>
          ) : listQuery.isError ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>无法加载文章列表</EmptyTitle>
                <EmptyDescription>{formatAdminApiError(listQuery.error)}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : pageItems.length === 0 ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">标题</TableHead>
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">状态</TableHead>
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">难度</TableHead>
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">主题</TableHead>
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">更新</TableHead>
                  <TableHead className="h-12 bg-muted/30 px-5 text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((article) => (
                  <TableRow
                    key={article.id}
                    className="border-border transition-colors duration-300 ease-out-soft hover:bg-muted/30"
                  >
                    <TableCell className="max-w-xs px-5 py-4 font-medium whitespace-normal text-foreground">
                      {article.title}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge variant={article.status === 'published' ? 'secondary' : 'outline'}>
                        {article.status === 'published' ? '已发布' : '草稿'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-muted-foreground">
                      {LEVEL_LABEL[article.level] ?? article.level}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-muted-foreground">{article.themes.join(' · ')}</TableCell>
                    <TableCell className="px-5 py-4 tabular-nums text-muted-foreground">
                      {formatUpdatedAt(article.updatedAt)}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        className="rounded-xl"
                        render={<Link href={ADMIN_ROUTES.articleEdit(article.id)} />}
                      >
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          共 {articles.length} 篇 · 第 {safePage} / {totalPages} 页 · 每页 {ADMIN_ARTICLES_PAGE_SIZE}
        </p>
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent className="gap-2">
            <PaginationItem>
              <PaginationPrevious
                text="上一页"
                href="#"
                aria-disabled={safePage <= 1}
                className={cn(
                  'h-9 rounded-xl border border-border bg-background px-3.5',
                  safePage <= 1 && 'pointer-events-none opacity-50',
                )}
                onClick={(event) => {
                  event.preventDefault();
                  if (safePage <= 1) {
                    return;
                  }
                  replaceQuery({ page: safePage - 1 });
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                text="下一页"
                href="#"
                aria-disabled={safePage >= totalPages}
                className={cn(
                  'h-9 rounded-xl border border-border bg-background px-3.5',
                  safePage >= totalPages && 'pointer-events-none opacity-50',
                )}
                onClick={(event) => {
                  event.preventDefault();
                  if (safePage >= totalPages) {
                    return;
                  }
                  replaceQuery({ page: safePage + 1 });
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
