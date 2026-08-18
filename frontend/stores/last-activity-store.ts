import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LastActivityState {
  lastActivityAt: number | null;
  touch: () => void;
}

/**
 * Marca o instante da última interação do usuário — persistido (sobrevive
 * a fechar a aba/navegador) pra que o logoff por inatividade também valha
 * quando o app fica fechado por muito tempo, não só quando fica aberto e
 * ocioso. Ver `useIdleLogout`, que confere essa marca ao reabrir o app.
 */
export const useLastActivityStore = create<LastActivityState>()(
  persist(
    (set) => ({
      lastActivityAt: null,
      touch: () => set({ lastActivityAt: Date.now() }),
    }),
    { name: 'financeflow-last-activity' },
  ),
);
