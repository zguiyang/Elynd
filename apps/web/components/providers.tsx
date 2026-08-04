'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

import { QueryProvider } from '@/lib/query';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </QueryProvider>
  );
}
