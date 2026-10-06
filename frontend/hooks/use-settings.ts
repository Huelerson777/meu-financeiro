import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface UserSettings {
  theme: string;
  language: string;
  currency: string;
  dashboardWidgets: string[] | null;
  dashboardHiddenAccountIds: string[] | null;
  // Decimais chegam como string da API (ou ausentes em servidores mais antigos)
  monthlySpendingLimit?: string | number | null;
  projectionExpectedIncome?: string | number | null;
  projectionFlexibleSpend?: string | number | null;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => (r.data?.data ?? r.data) as UserSettings),
  });
}
