import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SingleValueTooltip } from '@/components/dashboard/chart-tooltips';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { NetWorthPoint } from '@/services/dashboard.service';

/** Patrimônio dos últimos meses: valor atual, variação no período e uma curva simples. */
export function NetWorthCard({ points, isLoading }: { points?: NetWorthPoint[]; isLoading: boolean }) {
  const first = points?.[0];
  const last = points?.[points.length - 1];
  const delta = first && last ? last.netWorth - first.netWorth : 0;
  const up = delta >= 0;
  const data = (points ?? []).map((p) => ({ name: p.month, total: p.netWorth }));

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
      </CardContent>
    </Card>
  );
}
