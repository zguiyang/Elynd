'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTH_ROUTES } from '@/constants';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function useLandingUser() {
  const { data, isPending } = authClient.useSession();
  return { user: data?.user ?? null, isPending };
}

type LandingPrimaryCtaProps = {
  label: string;
  className?: string;
};

export function LandingPrimaryCta({ label, className }: LandingPrimaryCtaProps) {
  const { user, isPending } = useLandingUser();

  if (isPending) {
    return <Skeleton className={cn('h-14 w-40 rounded-xl', className)} />;
  }

  const href = user ? AUTH_ROUTES.dashboard : AUTH_ROUTES.signUp;

  return (
    <Button
      nativeButton={false}
      className={cn(
        'h-auto rounded-xl bg-primary px-8 py-4 text-base font-medium text-primary-foreground hover:bg-brand-deep',
        'active:scale-[0.98]',
        className,
      )}
      render={<Link href={href} />}
    >
      {label}
    </Button>
  );
}
