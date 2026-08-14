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

  getPaymentsStatus: (params?: { month?: number; year?: number }) =>
    api
      .get<{ data: PaymentsStatus }>('/dashboard/payments-status', { params })
      .then((r) => r.data.data),

  getNetWorthTrend: (months?: number) =>
    api
      .get<{ data: NetWorthPoint[] }>('/dashboard/net-worth-trend', { params: { months } })
      .then((r) => r.data.data),

  getGoalsSummary: () =>
    api.get<{ data: GoalsSummary }>('/dashboard/goals-summary').then((r) => r.data.data),
};

export interface NetWorthPoint {
  key: string;
  month: string;
  netWorth: number;
}

export interface GoalsSummaryItem {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  progress: number;
  deadline: string | null;
}

export interface GoalsSummary {
  count: number;
  totalTarget: number;
  totalCurrent: number;
  overallProgress: number;
  goals: GoalsSummaryItem[];
}

export interface PaymentsStatusItem {
  id: string;
  kind: 'transaction' | 'installment';
  type: 'INCOME' | 'EXPENSE';
  description: string;
  amount: number;
  dueDate: string;
  source: string;
  category: { name: string; color: string } | null;
  isOverdue: boolean;
}

export interface PaymentsStatus {
  paidExpenseTotal: number;
  paidIncomeTotal: number;
  openExpenseTotal: number;
  openIncomeTotal: number;
  openItems: PaymentsStatusItem[];
}

export interface CategoryExpense {
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  total: number;
}
