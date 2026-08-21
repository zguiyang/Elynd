'use client';

import { BookOpenIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';

/** Shared 404 when a learner article is unpublished or gone. */
export function LearnUnavailable() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background px-6 py-16">
      <Empty className="w-full max-w-md flex-none border-0 py-4">
        <EmptyHeader className="max-w-none">
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl">这篇已下架</EmptyTitle>
          <EmptyDescription>可能涉及版权或其他原因。抱歉给你添麻烦了。</EmptyDescription>
        </EmptyHeader>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.discover} />}
          >
            去图书馆
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            className="h-11 rounded-xl px-6"
            render={<Link href={AUTH_ROUTES.shelf} />}
          >
            回今日
          </Button>
        </div>
      </Empty>
    </div>
  );
}
