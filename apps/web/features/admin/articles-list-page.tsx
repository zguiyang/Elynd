'use client';

import { FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { type ArticleStatus } from '@elynd/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@elynd/shared/api/pagination';

import { LoadingOverlay } from '@/components/loading-overlay';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import {
  type AdminArticle,
  adminArticlesQueryKey,
  type AdminListParams,
  type AdminListResult,
  formatAdminApiError,
  listAdminArticles,
} from '@/features/admin/articles-api';
import { LEVEL_LABEL } from '@/features/library/library-model';
import { usePaginatedQuery } from '@/lib/query';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | ArticleStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
];

const TABLE_REFRESH_MIN_MS = 300;
const TABLE_SKELETON_ROW_COUNT = 6;

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

function ArticlesTableSkeleton({ rows }: { rows: number }) {
  return (
    <Table className="min-w-[40rem]" aria-hidden>
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
        {Array.from({ length: rows }, (_, index) => (
          <TableRow key={index} className="border-border hover:bg-transparent">
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-44 max-w-full bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-5 w-14 rounded-full bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-12 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-28 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-20 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-8 w-12 rounded-xl bg-muted/70" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ArticlesListPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState<number>(DEFAULT_PAGE);

  const listParams: AdminListParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    status: status === 'all' ? undefined : status,
  };

  const list = usePaginatedQuery<AdminArticle, AdminListResult>({
    queryKey: adminArticlesQueryKey.list(listParams),
    queryFn: ({ signal }) => listAdminArticles(listParams, { signal }),
    page,
    onPageChange: setPage,
    softRefreshMinMs: TABLE_REFRESH_MIN_MS,
  });

  const emptyTitle = list.total === 0 && status !== 'all' ? '当前筛选下没有文章' : '还没有文章';
  const emptyDescription =
    list.total === 0 && status !== 'all' ? '试试切换状态筛选，或新建一篇短文。' : '点「新建文章」开始粘贴内容。';

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
            setStatus(value);
            setPage(DEFAULT_PAGE);
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

        <div
          className="overflow-hidden rounded-3xl border border-border bg-card"
          aria-busy={list.isInitialLoading || list.isSoftRefreshing}
        >
          {list.isInitialLoading ? (
            <ArticlesTableSkeleton rows={TABLE_SKELETON_ROW_COUNT} />
          ) : list.isError && !list.data ? (
            <Empty className="border-0 py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>无法加载文章列表</EmptyTitle>
                <EmptyDescription>{formatAdminApiError(list.error)}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : list.items.length === 0 ? (
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
            <LoadingOverlay active={list.isSoftRefreshing} label="列表更新中…">
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
                  {list.items.map((article) => (
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
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            nativeButton={false}
                            className="rounded-xl"
                            render={<Link href={ADMIN_ROUTES.articleEdit(article.id)} />}
                          >
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            nativeButton={false}
                            className="rounded-xl"
                            render={<Link href={ADMIN_ROUTES.articlePractice(article.id)} />}
                          >
                            练习题
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </LoadingOverlay>
          )}
        </div>
      </div>

      {!list.isInitialLoading && !list.isError ? (
        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            共 {list.total} 篇 · 第 {list.totalPages === 0 ? 0 : list.page} / {list.totalPages} 页 · 每页{' '}
            {DEFAULT_PAGE_SIZE}
          </p>
          {list.hasPrevPage || list.hasNextPage ? (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent className="gap-2">
                <PaginationItem>
                  <PaginationPrevious
                    text="上一页"
                    href="#"
                    aria-disabled={!list.hasPrevPage}
                    className={cn(
                      'h-9 rounded-xl border border-border bg-background px-3.5',
                      !list.hasPrevPage && 'pointer-events-none opacity-50',
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      list.goPrev();
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    text="下一页"
                    href="#"
                    aria-disabled={!list.hasNextPage}
                    className={cn(
                      'h-9 rounded-xl border border-border bg-background px-3.5',
                      !list.hasNextPage && 'pointer-events-none opacity-50',
                    )}
                    onClick={(event) => {
                      event.preventDefault();
                      list.goNext();
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
