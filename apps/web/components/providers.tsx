'use client'

import { Toaster } from 'sonner'
import type { ReactNode } from 'react'

import { QueryProvider } from '@/lib/query'
import { StoreProvider } from '@/stores'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <StoreProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </StoreProvider>
    </QueryProvider>
  )
}
