import { api } from './api';

export interface InvestmentPosition {
  id: string;
  name: string;
  category: 'STOCK' | 'FIXED_INCOME' | 'FUND' | 'CRYPTO' | 'REAL_ESTATE' | 'OTHER';
  ticker: string | null;
  indexer: 'CDI' | 'SELIC' | 'IPCA_PLUS' | 'PREFIXADO' | null;
  rate: number | null;
  startDate: string | null;
  invested: number;
  current: number;
  profit: number;
  profitPct: number;
  lastValuedAt: string | null;
}

export interface CreatePositionPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  name: string;
  category: InvestmentPosition['category'];
  quantity?: number;
  ticker?: string;
  indexer?: InvestmentPosition['indexer'];
  rate?: number;
  startDate?: string;
  date?: string;
  description?: string;
}

export const investmentsService = {
  listPositions: () => api.get<{ data: InvestmentPosition[] }>('/investments/positions').then((r) => r.data.data),

  createPosition: (payload: CreatePositionPayload) =>
    api.post('/investments/positions', payload).then((r) => r.data.data),

  updatePosition: (id: string, payload: Partial<CreatePositionPayload> & { currentPrice?: number }) =>
    api.patch(`/investments/positions/${id}`, payload).then((r) => r.data.data),

  deletePosition: (id: string) => api.delete(`/investments/positions/${id}`).then((r) => r.data.data),
};
