import axios from 'axios';
import { useAuthStore } from '@/stores/auth-store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
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
        let refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken && typeof window !== 'undefined') {
          refreshToken = localStorage.getItem('refreshToken');
        }

        if (refreshToken) {
          const { data } = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`,
            { refreshToken },
          );
          
          const newAccessToken = data?.data?.accessToken || data?.accessToken;
          const newRefreshToken = data?.data?.refreshToken || data?.refreshToken;

          if (newAccessToken && newRefreshToken) {
            useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
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