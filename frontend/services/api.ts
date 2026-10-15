import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

// Base relativa (/api-proxy) = API sob a mesma origem do site: o refresh
// token trafega só no cookie httpOnly (first-party) e nunca chega ao JS.
// Com URL absoluta mantém o contrato antigo (refreshToken no corpo).
export const USES_COOKIE_TRANSPORT = API_BASE_URL.startsWith('/');
export const TRANSPORT_HEADERS: Record<string, string> = USES_COOKIE_TRANSPORT
  ? { 'X-Token-Transport': 'cookie' }
  : {};

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: TRANSPORT_HEADERS,
  withCredentials: USES_COOKIE_TRANSPORT,
});

api.interceptors.request.use((config) => {
  // Tenta pegar o token do Zustand primeiro, se não tiver pega do LocalStorage
  let token = useAuthStore.getState().accessToken;

  if (!token && typeof window !== 'undefined') {
    token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  }

  if (token) {
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }
  return config;
});

let isRefreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshing) {
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Cookie mode: o navegador manda o cookie sozinho. O token do
        // localStorage só existe pra sessões antigas (migração) — vai no corpo
        // uma única vez, o backend troca por cookie e o legado é apagado.
        const legacy = useAuthStore.getState().refreshToken;
        const refreshToken =
          legacy ?? (USES_COOKIE_TRANSPORT || typeof window === 'undefined' ? null : localStorage.getItem('refreshToken'));

        if (USES_COOKIE_TRANSPORT || refreshToken) {
          const { data } = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            refreshToken ? { refreshToken } : {},
            { headers: TRANSPORT_HEADERS, withCredentials: USES_COOKIE_TRANSPORT },
          );

          const newAccessToken = data?.data?.accessToken || data?.accessToken;
          const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;

          if (newAccessToken) {
            const { rememberMe } = useAuthStore.getState();
            useAuthStore.getState().setTokens(newAccessToken, newRefreshToken ?? null, rememberMe);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        }
      } catch {
        useAuthStore.getState().logout();
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
