'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { type WorkStatus } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { ADMIN_ROUTES } from '@/constants';
import { AdminSegmentedTabsList, AdminSegmentedTabsTrigger } from '@/features/admin/admin-segmented-tabs';
import {
  deleteAdminWork,
  formatWorksApiError,
  publishAdminWork,
  unpublishAdminWork,
  useAdminWorksListQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';

const STATUS_FILTERS: { value: WorkStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
];

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WorksTableSkeleton({ rows }: { rows: number }) {
  return (
    <Table aria-hidden>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标题</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">状态</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标签</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">更新</TableHead>
          <TableHead className="h-12 w-[1%] bg-surface-container-low px-5 text-right text-muted-foreground">
            操作
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }, (_, index) => (
          <TableRow key={index} className="border-border hover:bg-transparent">
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-40 max-w-full bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-5 w-12 rounded-full bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-24 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-24 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4 text-right">
              <Skeleton className="ml-auto h-7 w-20 rounded-xl bg-muted/70" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorksListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<WorkStatus | 'all'>('all');
  const invalidate = useInvalidateAdminWorks();
  const listQuery = useAdminWorksListQuery(statusFilter === 'all' ? {} : { status: statusFilter });

  async function handlePublish(id: string) {
    try {
      await publishAdminWork(id);
      await invalidate(id);
      toast.success('已发布');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handleUnpublish(id: string) {
    try {
      await unpublishAdminWork(id);
      await invalidate(id);
      toast.success('已下架');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('确定删除此作品？')) return;
    try {
      await deleteAdminWork(id);
      await invalidate();
      toast.success('已删除');
    } catch (error) {
      toast.error(formatWorksApiError(error));
    }
  }

  const items = listQuery.data?.items ?? [];

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto w-full max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">作品</h1>
          <p className="mt-1 text-sm text-muted-foreground">维护阅读作品：标题、正文与标签（admin_text 内部种子）。</p>
        </div>
        <Button
          nativeButton={false}
          className="h-10 rounded-xl px-6 hover:bg-brand-deep"
          render={<Link href={ADMIN_ROUTES.workNew} />}
        >
          新建作品
        </Button>
      </div>

      <div className="mb-6 w-fit">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => {
            if (value === 'all' || value === 'draft' || value === 'published') {
              setStatusFilter(value);
            }
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
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {listQuery.isPending ? (
          <WorksTableSkeleton rows={4} />
        ) : listQuery.isError && !listQuery.data ? (
          <Empty className="border-0 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>无法加载作品列表</EmptyTitle>
              <EmptyDescription>{formatWorksApiError(listQuery.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : items.length === 0 ? (
          <Empty className="border-0 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>还没有作品</EmptyTitle>
              <EmptyDescription>新建一个作品开始维护内容。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标题</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">状态</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标签</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">更新</TableHead>
                <TableHead className="h-12 w-[1%] bg-surface-container-low px-5 text-right text-muted-foreground">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((work) => (
                <TableRow
                  key={work.id}
                  className="border-border transition-colors duration-300 ease-out-soft hover:bg-muted/60"
                >
                  <TableCell className="px-5 py-4 font-medium">{work.title}</TableCell>
                  <TableCell className="px-5 py-4">
                    <Badge
                      variant={
                        work.status === 'published' ? 'secondary' : work.status === 'failed' ? 'destructive' : 'outline'
                      }
                    >
                      {work.status === 'published'
                        ? '已发布'
                        : work.status === 'processing'
                          ? '解析中'
                          : work.status === 'failed'
                            ? '解析失败'
                            : work.status === 'archived'
                              ? '已归档'
                              : '草稿'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-muted-foreground">{work.tags.join(' · ') || '—'}</TableCell>
                  <TableCell className="px-5 py-4 text-muted-foreground">{formatUpdatedAt(work.updatedAt)}</TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(ADMIN_ROUTES.workEdit(work.id))}
                      >
                        编辑
                      </Button>
                      {work.status === 'draft' ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void handlePublish(work.id)}>
                          发布
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleUnpublish(work.id)}>
                          下架
                        </Button>
                      )}
                      {work.status === 'draft' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(work.id)}
                        >
                          删除
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
