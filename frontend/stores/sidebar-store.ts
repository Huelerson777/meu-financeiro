import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

/**
 * Preferência de "ocultar menu lateral" no desktop — persistida no cliente
 * para se manter entre reloads, igual à de ocultar valores.
 */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: 'financeflow-sidebar-collapsed' },
  ),
);
