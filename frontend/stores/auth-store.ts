import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { setSessionCookie, clearSessionCookie } from '@/utils/session-cookie';
import { useLastActivityStore } from './last-activity-store';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

/**
 * Estado de autenticação persistido no cliente.
 * Os tokens ficam em memória + localStorage (via persist) para sobreviver
 * a reloads; em produção considere httpOnly cookies para o refresh token.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) => {
        setSessionCookie();
        // Um login/registro bem-sucedido conta como atividade — sem isso,
        // um timestamp velho de uma sessão anterior (de horas atrás, já
        // além dos 15min) sobrevive no localStorage e o logoff por
        // inatividade dispara na cara de quem tinha acabado de entrar.
        useLastActivityStore.getState().touch();
        set({ accessToken, refreshToken });
      },
      logout: () => {
        clearSessionCookie();
        set({ user: null, accessToken: null, refreshToken: null });
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'financeflow-auth',
      onRehydrateStorage: () => (state) => {
        // Resincroniza o cookie do middleware com o que veio do localStorage
        // — cobre o caso raro de alguém limpar só os cookies do navegador e
        // manter o localStorage intacto (sem isso, o middleware acharia que
        // não há sessão e prenderia o usuário em /login mesmo autenticado).
        if (state?.accessToken) setSessionCookie();
        state?.setHasHydrated(true);
      },
    },
  ),
);
