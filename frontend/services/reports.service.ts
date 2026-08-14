import { api } from './api';

export interface CashFlowReport {
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  series: { key: string; receitas: number; despesas: number }[];
}

export interface CategoryReport {
  startDate: string;
  endDate: string;
  type: 'INCOME' | 'EXPENSE';
  total: number;
  items: { categoryId: string | null; name: string; color: string; icon: string; amount: number; percentage: number }[];
}

export interface AccountStatement {
  account: { id: string; name: string };
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: { date: string; description: string; amount: number; kind: string; balanceAfter: number }[];
}

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export const reportsService = {
  getCashFlow: (params?: DateRangeParams) =>
    api.get<{ data: CashFlowReport }>('/reports/cash-flow', { params }).then((r) => r.data.data),

  getByCategory: (params?: DateRangeParams & { type?: 'INCOME' | 'EXPENSE' }) =>
    api.get<{ data: CategoryReport }>('/reports/by-category', { params }).then((r) => r.data.data),

  getAccountStatement: (accountId: string, params?: DateRangeParams) =>
    api
      .get<{ data: AccountStatement }>('/reports/account-statement', { params: { ...params, accountId } })
      .then((r) => r.data.data),

  exportTransactionsCsv: (params?: DateRangeParams) =>
    api
      .get<{ data: { csv: string; filename: string } }>('/reports/export/transactions', { params })
      .then((r) => r.data.data),
};
