import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';

interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export function useCashFlowReport(params: DateRangeParams) {
  return useQuery({
    queryKey: ['reports', 'cash-flow', params.startDate, params.endDate],
    queryFn: () => reportsService.getCashFlow(params),
  });
}

export function useCategoryReport(params: DateRangeParams & { type: 'INCOME' | 'EXPENSE' }) {
  return useQuery({
    queryKey: ['reports', 'by-category', params.startDate, params.endDate, params.type],
    queryFn: () => reportsService.getByCategory(params),
  });
}

export function useAccountStatement(accountId: string | null, params: DateRangeParams) {
  return useQuery({
    queryKey: ['reports', 'account-statement', accountId, params.startDate, params.endDate],
    queryFn: () => reportsService.getAccountStatement(accountId as string, params),
    enabled: !!accountId,
  });
}
