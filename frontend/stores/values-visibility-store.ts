import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ValuesVisibilityState {
  hidden: boolean;
  toggle: () => void;
}

/**
 * Preferência de "ocultar valores" (privacidade em tela) — persistida no
 * cliente para se manter entre reloads. Lida diretamente por
 * `formatCurrency` (via getState()), então basta trocar esse estado para
 * mascarar todo valor monetário exibido no app.
 */
export const useValuesVisibilityStore = create<ValuesVisibilityState>()(
  persist(
    (set) => ({
      hidden: false,
      toggle: () => set((s) => ({ hidden: !s.hidden })),
    }),
    { name: 'financeflow-values-hidden' },
  ),
);
