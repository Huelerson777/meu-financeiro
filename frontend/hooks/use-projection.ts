import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard.service';
import { useAccounts } from '@/hooks/use-accounts';
import { api } from '@/services/api';

export interface ProjectionSettings {
  /** Receita mensal esperada (meses futuros). Vazio = usa a média dos últimos meses. */
  income: string;
  /** Teto mensal para gastos do dia a dia (mercado, lazer, transporte...). */
  flexible: string;
}

const STORAGE_KEY = 'poupay:projection';

export function useProjectionSettings() {
  const [settings, setSettings] = useState<ProjectionSettings>({ income: '', flexible: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ income: '', flexible: '', ...JSON.parse(raw) });
    } catch {
      /* sem storage: segue com o padrão */
    }
  }, []);

  const update = (next: Partial<ProjectionSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        /* ignora */
      }
      return merged;
    });
  };

  return { settings, update };
}

export interface ProjectionMonth {
  key: string;
  label: string;
  isCurrent: boolean;
  startBalance: number;
  income: number;
  recurring: number;
  installments: number;
  flexible: number;
  net: number;
  endBalance: number;
  loading: boolean;
}

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Projeta o saldo mês a mês só com o que já existe no app: saldo atual das contas,
 * contas fixas ativas, parcelas em aberto (cartão e fora dele) e duas premissas
 * do usuário — receita esperada e teto de gastos do dia a dia.
 */
export function useProjection(horizon: number, settings: ProjectionSettings) {
  const now = new Date();
  const months = useMemo(
    () =>
      Array.from({ length: horizon }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        return { month: d.getMonth() + 1, year: d.getFullYear(), index: i };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [horizon],
  );

  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ['projection', 'recurring-bills'],
    queryFn: () => api.get('/recurring-bills').then((r) => r.data),
  });
  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => dashboardService.getSummary({ month: now.getMonth() + 1, year: now.getFullYear() }),
  });

  const statuses = useQueries({
    queries: months.map((m) => ({
      queryKey: ['dashboard', 'payments-status', m.month, m.year],
      queryFn: () => dashboardService.getPaymentsStatus({ month: m.month, year: m.year }),
      staleTime: 60_000,
    })),
  });

  const billList: any[] = Array.isArray(bills) ? bills : Array.isArray(bills?.data) ? bills.data : [];
  const activeBills = billList.filter((b) => b.isActive);
  const monthlyBills = activeBills.reduce((s, b) => s + toNumber(b.defaultAmount), 0);
  const variableBills = activeBills.filter((b) => b.defaultAmount == null).length;

  const accounts: any[] = accountsData?.items ?? [];
  const currentBalance = accounts
    .filter((a) => a.includeInDashboard)
    .reduce((s, a) => s + toNumber(a.currentBalance ?? a.initialBalance), 0);

  // média de receita dos meses já fechados neste ano (últimos 3 com valor)
  const flow = summary?.monthlyFlow ?? [];
  const pastIncome = flow
    .slice(0, now.getMonth())
    .map((f) => toNumber(f.receitas))
    .filter((v) => v > 0)
    .slice(-3);
  const suggestedIncome = pastIncome.length ? pastIncome.reduce((a, b) => a + b, 0) / pastIncome.length : 0;

  const expectedIncome = settings.income !== '' ? toNumber(settings.income.replace(',', '.')) : suggestedIncome;
  const flexibleLimit = toNumber(settings.flexible.replace(',', '.'));

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;

  let running = currentBalance;
  const rows: ProjectionMonth[] = months.map((m, i) => {
    const ps = statuses[i]?.data;
    const openItems = ps?.openItems ?? [];
    const installments = openItems
      .filter((it) => it.kind === 'installment' && it.type === 'EXPENSE')
      .reduce((s, it) => s + it.amount, 0);
    const pendingOther = Math.max(0, toNumber(ps?.openExpenseTotal) - installments);
    // mês corrente já tem as contas fixas geradas como pendentes; os futuros ainda não
    const recurring = m.index === 0 ? pendingOther : Math.max(monthlyBills, pendingOther);
    // mês corrente: o que ainda falta entrar para chegar na receita esperada (ou o que já está agendado, se for maior)
    const income =
      m.index === 0
        ? Math.max(toNumber(ps?.openIncomeTotal), expectedIncome - toNumber(ps?.paidIncomeTotal), 0)
        : expectedIncome;
    const flexible = m.index === 0 ? flexibleLimit * (daysLeft / daysInMonth) : flexibleLimit;
    const net = income - recurring - installments - flexible;
    const startBalance = running;
    running = startBalance + net;
    return {
      key: `${m.year}-${m.month}`,
      label: `${MONTH_SHORT[m.month - 1]}/${String(m.year).slice(2)}`,
      isCurrent: m.index === 0,
      startBalance,
      income,
      recurring,
      installments,
      flexible,
      net,
      endBalance: running,
      loading: statuses[i]?.isLoading ?? true,
    };
  });

  return {
    rows,
    currentBalance,
    suggestedIncome,
    expectedIncome,
    variableBills,
    isLoading: accountsLoading || billsLoading,
  };
}
