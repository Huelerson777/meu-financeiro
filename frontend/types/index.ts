export type AccountType = 'CHECKING' | 'SAVINGS' | 'WALLET' | 'CASH' | 'INVESTMENT';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  initialBalance?: number;
  color?: string;
  icon?: string;
  includeInDashboard: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  plan: 'FREE' | 'PREMIUM';
}

export interface DashboardSummary {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalInvested: number;
  leftovers: number;
  monthlyFlow: MonthlyFlowItem[];
}

export interface MonthlyFlowItem {
  month: string;
  receitas: number;
  despesas: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  parentId?: string | null;
}
