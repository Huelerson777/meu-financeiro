'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import { effectiveDate, isEffectivelyPaid } from '@/utils/transaction-status';

interface RecentTransaction {
  id: string;
  description: string;
  amount: number | string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: 'PAID' | 'PENDING';
  date: string;
  installments?: { paid: boolean; paidAt?: string | null }[] | null;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
}

/** Últimos lançamentos agrupados por dia (Hoje, Ontem, …) com categoria e valor. */
export function RecentTransactionsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'recent-transactions'],
    queryFn: async () => {
      // Só o que já aconteceu: até hoje (parcelas futuras ficam de fora) e nos últimos 60 dias
      const iso = (d: Date) => d.toISOString().split('T')[0];
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const res = await api.get('/transactions', { params: { limit: 30, startDate: iso(start), endDate: iso(end) } });
      const raw = res.data;
      const list: RecentTransaction[] = Array.isArray(raw?.data?.items) ? raw.data.items : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
      // ordena pela data em que de fato aconteceu (pagamento da parcela, quando for o caso)
      return list.sort((a, b) => effectiveDate(b).localeCompare(effectiveDate(a))).slice(0, 8);
    },
    refetchInterval: 60_000,
  });

  const groups: { label: string; items: RecentTransaction[] }[] = [];
  (data ?? []).forEach((t) => {
    const label = dayLabel(effectiveDate(t));
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Transações recentes</CardTitle>
        <Link href="/transactions" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : groups.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma transação registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
                <ul className="divide-y divide-border/70">
                  {g.items.map((t) => {
                    const isIncome = t.type === 'INCOME';
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.description}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {t.account?.name}
                            {!isEffectivelyPaid(t) && <span className="rounded bg-warning/10 px-1.5 py-px text-[10px] font-semibold text-warning">pendente</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                          {t.category && (
                            <span
                              className="hidden rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline"
                              style={{ backgroundColor: `${t.category.color}20`, color: t.category.color }}
                            >
                              {t.category.name}
                            </span>
                          )}
                          <span className={cn('font-num text-sm font-bold', isIncome && 'text-success')}>
                            {isIncome ? '+ ' : ''}
                            {formatCurrency(Number(t.amount))}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
