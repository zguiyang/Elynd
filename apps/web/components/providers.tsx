'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/lib/query';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <TooltipProvider delay={300}>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </QueryProvider>
  );
}
