import { useEffect, useState } from 'react';

const STORAGE_KEY = 'poupay:monthly-limit';

/** Limite de gasto do mês definido pelo usuário (guardado só neste navegador). */
export function useMonthlyLimit() {
  const [limit, setLimitState] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const n = raw == null ? NaN : Number(raw);
      if (Number.isFinite(n) && n > 0) setLimitState(n);
    } catch {
      /* sem storage: sem limite */
    }
  }, []);

  const setLimit = (value: number | null) => {
    setLimitState(value);
    try {
      if (value == null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignora */
    }
  };

  return { limit, setLimit };
}
