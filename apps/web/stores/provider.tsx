'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import { useStore } from 'zustand';

import { createUiStore, type UiState, type UiStore } from './ui-store';

const UiStoreContext = createContext<UiStore | null>(null);

type StoreProviderProps = {
  children: ReactNode;
};

export function StoreProvider({ children }: StoreProviderProps) {
  const [store] = useState(() => createUiStore());

  return <UiStoreContext.Provider value={store}>{children}</UiStoreContext.Provider>;
}

export function useUiStore<T>(selector: (state: UiState) => T): T {
  const store = useContext(UiStoreContext);

  if (!store) {
    throw new Error('useUiStore must be used within StoreProvider');
  }

  return useStore(store, selector);
}
