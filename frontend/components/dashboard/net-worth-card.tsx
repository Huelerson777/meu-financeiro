import { ArrowDownRight, ArrowUpRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAccounts } from '@/hooks/use-accounts';
import { api } from '@/services/api';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SingleValueTooltip } from '@/components/dashboard/chart-tooltips';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { NetWorthPoint } from '@/services/dashboard.service';


function listOf(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  return [];
}

/** Ativos (saldo das contas) x dívidas (limite usado nos cartões + parcelas em aberto fora do cartão). */
function useDebtSummary() {
  const { data: accountsData } = useAccounts();
  const { data, isLoading } = useQuery({
    queryKey: ['networth', 'debts'],
    queryFn: async () => {
      const [cards, purchases] = await Promise.all([
        api.get('/cards').then((r) => listOf(r.data)).catch(() => []),
        api.get('/installment-purchases').then((r) => listOf(r.data)).catch(() => []),
      ]);
      const cardDebt = cards.reduce((s, c) => s + Number(c.usedLimit ?? 0), 0);
      const installmentDebt = purchases.reduce(
        (s, p) => s + (p.items ?? []).filter((i: any) => !i.paid).reduce((t: number, i: any) => t + Number(i.amount ?? 0), 0),
        0,
      );
      return { cardDebt, installmentDebt };
    },
    staleTime: 60_000,
  });

  const assets = (accountsData?.items ?? []).reduce((s: number, a: any) => s + Math.max(0, Number(a.currentBalance ?? 0)), 0);
  const debts = (data?.cardDebt ?? 0) + (data?.installmentDebt ?? 0);
  return { assets, debts, ratio: assets > 0 ? debts / assets : null, isLoading };
}

/** Patrimônio dos últimos meses: valor atual, variação no período e uma curva simples. */
export function NetWorthCard({ points, isLoading }: { points?: NetWorthPoint[]; isLoading: boolean }) {
  const first = points?.[0];
  const last = points?.[points.length - 1];
  const delta = first && last ? last.netWorth - first.netWorth : 0;
  const up = delta >= 0;
  const data = (points ?? []).map((p) => ({ name: p.month, total: p.netWorth }));
  const debt = useDebtSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Patrimônio ao longo do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : !points || points.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Ainda não há histórico suficiente para desenhar a curva.
          </p>
        ) : (
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div>
              <p className="font-num text-4xl font-bold leading-none">{formatCurrency(last!.netWorth)}</p>
              <p className={cn('mt-3 inline-flex items-center gap-1 text-sm font-semibold', up ? 'text-success' : 'text-danger')}>
                {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {up ? '+' : '-'}
                {formatCurrency(Math.abs(delta))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                desde {first!.month} · {points.length} meses
              </p>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, left: 4, right: 4 }}>
                  <defs>
                    <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <RechartsTooltip content={<SingleValueTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#nwFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {!isLoading && !debt.isLoading && (debt.assets > 0 || debt.debts > 0) && (
          <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="font-num mt-0.5 text-lg font-bold">{formatCurrency(debt.assets)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dívidas</p>
              <p className="font-num mt-0.5 text-lg font-bold">{formatCurrency(debt.debts)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">limite usado nos cartões + parcelas em aberto</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Endividamento</p>
              {debt.ratio == null ? (
                <p className="mt-1 text-sm text-muted-foreground">Sem ativos para comparar</p>
              ) : (
                <>
                  <p className={cn('font-num mt-0.5 flex items-center gap-1.5 text-lg font-bold', debt.ratio > 0.5 ? 'text-danger' : debt.ratio > 0.3 ? 'text-warning' : 'text-success')}>
                    {debt.ratio > 0.5 ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    {Math.round(debt.ratio * 100)}%
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    do que você tem está comprometido com dívidas. {debt.ratio > 0.5 ? 'Acima de 50% merece atenção.' : 'Quanto menor, melhor.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
