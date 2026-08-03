export type AccountType = 'CHECKING' | 'SAVINGS' | 'WALLET' | 'CASH' | 'INVESTMENT';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  color?: string;
  icon?: string;
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
  cardsUsedLimit: number;
  cardsTotalLimit: number;
  goalsCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}
