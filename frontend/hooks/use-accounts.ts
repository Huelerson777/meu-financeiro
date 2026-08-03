import { useQuery } from '@tanstack/react-query';
import { accountsService } from '@/services/accounts.service';

export function useAccounts(search?: string) {
  return useQuery({
    queryKey: ['accounts', search],
    queryFn: () => accountsService.list({ search }),
  });
}
