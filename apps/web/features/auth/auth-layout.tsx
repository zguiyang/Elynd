import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

type AuthLayoutProps = {
  children: ReactNode;
  headerAction?: { href: string; label: string };
};

export function AuthLayout({ children, headerAction }: AuthLayoutProps) {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col">
      <header className="px-6 pt-7 md:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BrandMark />
          {headerAction ? (
            <Link
              href={headerAction.href}
              className="text-sm text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-foreground"
            >
              {headerAction.label}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-14 md:py-20">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:ease-out w-full max-w-[26rem]">
          {children}
        </div>
      </main>

      <footer className="px-6 pb-8 text-center text-sm text-muted-foreground/70">独立开发 · 读自己想读的英语</footer>
    </div>
  );
}

type AuthIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

export function AuthIntro({ eyebrow, title, description, className }: AuthIntroProps) {
  return (
    <div className={cn('mb-10 text-center md:text-left', className)}>
      <p className="mb-4 text-sm font-medium tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

type AuthPanelProps = {
  children: ReactNode;
  className?: string;
};

export function AuthPanel({ children, className }: AuthPanelProps) {
  return (
    <div className={cn('rounded-3xl bg-card p-7 shadow-card ring-1 ring-foreground/5 md:p-8', className)}>
      {children}
    </div>
  );
}

type AuthFooterLinkProps = {
  prompt?: string;
  href: string;
  label: string;
};

export function AuthFooterLink({ prompt, href, label }: AuthFooterLinkProps) {
  return (
    <p className="mt-8 text-center text-sm text-muted-foreground">
      {prompt ? `${prompt} ` : null}
      <Link
        href={href}
        className="font-medium text-foreground transition-colors duration-300 ease-out-soft hover:text-primary"
      >
        {label}
      </Link>
    </p>
  );
}
