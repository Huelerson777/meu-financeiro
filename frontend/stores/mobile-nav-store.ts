import { create } from 'zustand';

interface MobileNavState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
}));