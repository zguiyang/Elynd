'use client';

import { Eye, FileText, MoreHorizontal, PencilLine, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { type WorkStatus } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  reparseAdminWork,
  unpublishAdminWork,
  useAdminWorksListQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';
import type { AdminWorkSummaryView } from '@/features/works-http';

const STATUS_FILTERS: { value: WorkStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'processing', label: '解析中' },
  { value: 'failed', label: '解析失败' },
  { value: 'published', label: '已发布' },
];

const STATUS_LABEL: Record<WorkStatus, string> = {
  draft: '草稿',
  processing: '解析中',
  published: '已发布',
  failed: '解析失败',
};

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type WorkRowActionsProps = {
  work: AdminWorkSummaryView;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onReparse: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Row actions: one status-primary action inline + the rest in a 「更多」 menu. */
function WorkRowActions({ work, onPublish, onUnpublish, onReparse, onDelete }: WorkRowActionsProps) {
  const router = useRouter();
  const canPreview = work.partCount > 0 && work.status !== 'processing' && work.status !== 'failed';

  return (
    <div className="flex justify-end gap-2">
      {work.status === 'draft' ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onPublish(work.id)}>
          发布
        </Button>
      ) : null}
      {work.status === 'published' ? (
        <Button type="button" size="sm" variant="outline" onClick={() => onUnpublish(work.id)}>
          下架
        </Button>
      ) : null}
      {work.status === 'failed' ? (
        <Button type="button" size="sm" variant="secondary" onClick={() => onReparse(work.id)}>
          重新解析
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" size="sm" variant="ghost" aria-label={`更多操作：${work.title}`} />}
        >
          <MoreHorizontal data-icon="inline-start" />
          更多
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {work.status !== 'published' ? (
            <DropdownMenuItem onClick={() => router.push(ADMIN_ROUTES.workDetail(work.id))}>
              <Play />
              继续处理
            </DropdownMenuItem>
          ) : null}
          {canPreview ? (
            <DropdownMenuItem onClick={() => router.push(ADMIN_ROUTES.workPreview(work.id))}>
              <Eye />
              预览章节
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => router.push(ADMIN_ROUTES.workEdit(work.id))}>
            <PencilLine />
            编辑
          </DropdownMenuItem>
          {work.status !== 'published' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(work.id)}>
                <Trash2 />
                删除
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function WorksTableSkeleton({ rows }: { rows: number }) {
  return (
    <Table aria-hidden>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标题</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">作者</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">状态</TableHead>
          <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">章节</TableHead>
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
              <Skeleton className="h-4 w-16 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-5 w-12 rounded-full bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-8 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4">
              <Skeleton className="h-4 w-24 bg-muted/70" />
            </TableCell>
            <TableCell className="px-5 py-4 text-right">
              <Skeleton className="ml-auto h-7 w-24 rounded-xl bg-muted/70" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorksListPage() {
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

  async function handleReparse(id: string) {
    try {
      await reparseAdminWork(id);
      await invalidate(id);
      toast.success('已重新开始解析');
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
          <p className="mt-1 text-sm text-muted-foreground">维护官方阅读作品：上传 EPUB、审查解析结果并发布到发现。</p>
        </div>
        <Button
          nativeButton={false}
          className="h-10 rounded-xl px-6 hover:bg-brand-deep"
          render={<Link href={ADMIN_ROUTES.workNew} />}
        >
          上传作品
        </Button>
      </div>

      <div className="mb-6 w-fit">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => {
            if (
              value === 'all' ||
              value === 'draft' ||
              value === 'processing' ||
              value === 'failed' ||
              value === 'published'
            ) {
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
              <EmptyDescription>上传一个 EPUB 开始维护内容。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">标题</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">作者</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">状态</TableHead>
                <TableHead className="h-12 bg-surface-container-low px-5 text-muted-foreground">章节</TableHead>
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
                  <TableCell className="px-5 py-4">
                    <Link
                      href={ADMIN_ROUTES.workDetail(work.id)}
                      className="font-medium underline-offset-4 transition-colors hover:text-brand-deep hover:underline"
                    >
                      {work.title}
                    </Link>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-muted-foreground">{work.author || '—'}</TableCell>
                  <TableCell className="px-5 py-4">
                    <Badge
                      variant={
                        work.status === 'published' ? 'secondary' : work.status === 'failed' ? 'destructive' : 'outline'
                      }
                    >
                      {STATUS_LABEL[work.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-muted-foreground">
                    {work.originKind === 'admin_epub' ? work.partCount : '—'}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-muted-foreground">{formatUpdatedAt(work.updatedAt)}</TableCell>
                  <TableCell className="px-5 py-4 text-right">
                    <WorkRowActions
                      work={work}
                      onPublish={(id) => void handlePublish(id)}
                      onUnpublish={(id) => void handleUnpublish(id)}
                      onReparse={(id) => void handleReparse(id)}
                      onDelete={(id) => void handleDelete(id)}
                    />
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
