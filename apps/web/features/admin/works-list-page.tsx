'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { type WorkStatus } from '@gloaming/shared/api/works';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ADMIN_ROUTES } from '@/constants';
import {
  deleteAdminWork,
  formatWorksApiError,
  publishAdminWork,
  unpublishAdminWork,
  useAdminWorksListQuery,
  useInvalidateAdminWorks,
} from '@/features/admin/works-api';

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">作品</h1>
          <p className="mt-1 text-sm text-muted-foreground">admin_text 内部种子 — 标题 + 正文</p>
        </div>
        <Button nativeButton={false} render={<Link href={ADMIN_ROUTES.workNew} />}>
          新建作品
        </Button>
      </div>

      <div className="mb-6 flex gap-2">
        {(['all', 'draft', 'published'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={statusFilter === value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(value)}
          >
            {value === 'all' ? '全部' : value === 'draft' ? '草稿' : '已发布'}
          </Button>
        ))}
      </div>

      {listQuery.isPending ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((work) => (
              <TableRow key={work.id}>
                <TableCell className="font-medium">{work.title}</TableCell>
                <TableCell>
                  <Badge variant={work.status === 'published' ? 'secondary' : 'outline'}>
                    {work.status === 'published' ? '已发布' : '草稿'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{work.tags.join(' · ') || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{formatUpdatedAt(work.updatedAt)}</TableCell>
                <TableCell className="text-right">
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
                      <Button type="button" size="sm" variant="destructive" onClick={() => void handleDelete(work.id)}>
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
  );
}
