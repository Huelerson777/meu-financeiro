import { usePlanningValue } from '@/hooks/use-planning-settings';

/** Limite de gasto do mês definido pelo usuário (servidor, com cópia no navegador). */
export function useMonthlyLimit() {
  const { value, save } = usePlanningValue('monthlySpendingLimit', 'poupay:monthly-limit');
  return { limit: value, setLimit: save };
}
