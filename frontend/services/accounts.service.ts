import { api } from './api';
import { Account, PaginatedResult } from '@/types';

export const accountsService = {
  list: (params?: { search?: string; page?: number }) =>
    api.get<{ data: PaginatedResult<Account> }>('/accounts', { params }).then((r) => r.data.data),

  create: (payload: { name: string; type: string; initialBalance?: number; color?: string }) =>
    api.post('/accounts', payload).then((r) => r.data.data),
};
