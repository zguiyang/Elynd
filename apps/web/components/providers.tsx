'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthDialogProvider } from '@/features/auth';
import { QueryProvider } from '@/lib/query';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <TooltipProvider delay={300}>
        <AuthDialogProvider>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </AuthDialogProvider>
      </TooltipProvider>
    </QueryProvider>
  );
}
