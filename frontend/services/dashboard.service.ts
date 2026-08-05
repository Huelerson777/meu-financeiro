import { api } from './api';
import { DashboardSummary } from '@/types';

export const dashboardService = {
  // ITEM 4 — passa month/year como query params
  getSummary: (params?: { month?: number; year?: number }) =>
    api
      .get<{ data: DashboardSummary }>('/dashboard/summary', { params })
      .then((r) => r.data.data),

  // ITEM 7 — busca despesas por categoria com nome/cor
  getExpensesByCategory: (params?: { month?: number; year?: number }) =>
    api
      .get<{ data: CategoryExpense[] }>('/dashboard/expenses-by-category', { params })
      .then((r) => r.data.data),

  getUpcomingBills: () =>
    api.get('/dashboard/upcoming-bills').then((r) => r.data.data),
};

export interface CategoryExpense {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  total: number;
}
