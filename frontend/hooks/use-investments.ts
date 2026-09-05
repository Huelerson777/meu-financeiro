import { useQuery } from '@tanstack/react-query';
import { investmentsService } from '@/services/investments.service';

export function useInvestmentPositions() {
  return useQuery({
    queryKey: ['investment-positions'],
    queryFn: () => investmentsService.listPositions(),
  });
}
