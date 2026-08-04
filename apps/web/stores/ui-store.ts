import { createStore } from 'zustand/vanilla';

export type UiState = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

export type UiStore = ReturnType<typeof createUiStore>;

export function createUiStore(init?: Partial<Pick<UiState, 'sidebarOpen'>>) {
  return createStore<UiState>()((set) => ({
    sidebarOpen: init?.sidebarOpen ?? false,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  }));
}
