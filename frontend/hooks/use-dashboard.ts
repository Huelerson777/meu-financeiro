import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';

// ITEM 4 — o hook agora aceita e repassa mês/ano para a API
export function useDashboardSummary(params?: { month?: number; year?: number }) {
  return useQuery({
    queryKey: ['dashboard', 'summary', params?.month, params?.year],
    queryFn: () => dashboardService.getSummary(params),
    refetchInterval: 30_000,
  });
}

export function useDashboardExpensesByCategory(params?: { month?: number; year?: number }) {
  return useQuery({
    queryKey: ['dashboard', 'expenses-by-category', params?.month, params?.year],
    queryFn: () => dashboardService.getExpensesByCategory(params),
    refetchInterval: 30_000,
  });
}
