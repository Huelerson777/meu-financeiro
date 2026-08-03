import { api } from './api';

export const authService = {
  login: (email: string, password: string, rememberMe?: boolean) =>
    api.post('/auth/login', { email, password, rememberMe }).then((r) => r.data.data),

  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }).then((r) => r.data.data),

  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};
