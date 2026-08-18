'use client';

import { BookOpenIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AUTH_ROUTES } from '@/constants';

/** Shared 404 when a learner article is unpublished or gone. */
export function LearnUnavailable() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col justify-center px-6 py-16">
      <Empty className="border border-dashed border-border bg-card/50 py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenIcon />
          </EmptyMedia>
          <EmptyTitle>这篇已下架</EmptyTitle>
          <EmptyDescription>可能涉及版权或其他原因。抱歉给你添麻烦了。</EmptyDescription>
        </EmptyHeader>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            nativeButton={false}
            className="h-11 rounded-xl px-6 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.library} />}
          >
            去图书馆
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            className="h-11 rounded-xl px-6"
            render={<Link href={AUTH_ROUTES.dashboard} />}
          >
            回今日
          </Button>
        </div>
      </Empty>
    </div>
  );
}
