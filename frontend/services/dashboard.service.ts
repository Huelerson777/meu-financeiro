import { api } from './api';
import { DashboardSummary } from '@/types';

export const dashboardService = {
  getSummary: () => api.get<{ data: DashboardSummary }>('/dashboard/summary').then((r) => r.data.data),
  getExpensesByCategory: () => api.get('/dashboard/expenses-by-category').then((r) => r.data.data),
  getUpcomingBills: () => api.get('/dashboard/upcoming-bills').then((r) => r.data.data),
};
