import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { setSessionCookie, clearSessionCookie } from '@/utils/session-cookie';
import { useLastActivityStore } from './last-activity-store';
import { API_BASE_URL, TRANSPORT_HEADERS, USES_COOKIE_TRANSPORT } from '@/services/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  hasHydrated: boolean;
  setUser: (user: User) => void;
  /** refreshToken só vem no corpo no modo legado (API em outra origem); no modo cookie fica null. */
  setTokens: (accessToken: string, refreshToken?: string | null, rememberMe?: boolean) => void;
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
      rememberMe: false,
      hasHydrated: false,
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken = null, rememberMe = false) => {
        setSessionCookie(rememberMe);
        // Um login/registro bem-sucedido conta como atividade — sem isso,
        // um timestamp velho de uma sessão anterior (de horas atrás, já
        // além dos 15min) sobrevive no localStorage e o logoff por
        // inatividade dispara na cara de quem tinha acabado de entrar.
        useLastActivityStore.getState().touch();
        set({ accessToken, refreshToken, rememberMe });
      },
      logout: () => {
        // Revoga no servidor e limpa o cookie httpOnly (best-effort — o
        // logout local não pode depender da rede).
        if (typeof window !== 'undefined') {
          const { refreshToken } = useAuthStore.getState();
          fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            credentials: USES_COOKIE_TRANSPORT ? 'include' : 'omit',
            headers: { 'Content-Type': 'application/json', ...TRANSPORT_HEADERS },
            body: JSON.stringify(refreshToken ? { refreshToken } : {}),
          }).catch(() => undefined);
        }
        clearSessionCookie();
        set({ user: null, accessToken: null, refreshToken: null, rememberMe: false });
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'poupay-auth',
      onRehydrateStorage: () => (state) => {
        // Resincroniza o cookie do middleware com o que veio do localStorage
        // — cobre o caso raro de alguém limpar só os cookies do navegador e
        // manter o localStorage intacto (sem isso, o middleware acharia que
        // não há sessão e prenderia o usuário em /login mesmo autenticado).
        if (state?.accessToken) setSessionCookie(state.rememberMe);
        state?.setHasHydrated(true);
      },
    },
  ),
);
