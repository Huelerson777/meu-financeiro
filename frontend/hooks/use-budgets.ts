import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface Budget {
  id: string;
  categoryId: string;
  category?: { name: string; color: string; icon: string };
  month: number;
  year: number;
  amount: number;
}

const unwrap = <T,>(raw: any): T => (raw?.data !== undefined && !Array.isArray(raw) ? raw.data : raw) as T;

/** Orçamentos do mês. Em um servidor sem o recurso (404) devolve lista vazia em vez de quebrar a tela. */
export function useBudgets(month: number, year: number) {
  return useQuery({
    queryKey: ['budgets', month, year],
    queryFn: () =>
      api
        .get('/budgets', { params: { month, year } })
        .then((r) => unwrap<Budget[]>(r.data) ?? [])
        .catch(() => [] as Budget[]),
  });
}

export function useBudgetMutations(month: number, year: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['budgets', month, year] });

  const save = useMutation({
    mutationFn: (v: { categoryId: string; amount: number }) => api.put('/budgets', { ...v, month, year }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: invalidate,
  });
  const copyPrevious = useMutation({
    mutationFn: () => api.post('/budgets/copy-previous', null, { params: { month, year } }).then((r) => unwrap<{ copied: number }>(r.data)),
    onSuccess: invalidate,
  });

  return { save, remove, copyPrevious };
}
