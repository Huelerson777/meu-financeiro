import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SingleValueTooltip } from '@/components/dashboard/chart-tooltips';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { CategoryExpense } from '@/services/dashboard.service';

interface CategoryDonutCardProps {
  data?: CategoryExpense[];
  previous?: CategoryExpense[];
  isLoading: boolean;
  onSelect: (categoryId: string | null) => void;
}

const MAX_ROWS = 6;

/** Rosca com o total gasto no centro + lista por categoria (percentual, valor e variação vs. mês anterior). */
export function CategoryDonutCard({ data, previous, isLoading, onSelect }: CategoryDonutCardProps) {
  const sorted = [...(data ?? [])].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const total = sorted.reduce((s, c) => s + c.total, 0);
  const rows = sorted.slice(0, MAX_ROWS);
  const rest = sorted.slice(MAX_ROWS).reduce((s, c) => s + c.total, 0);

  const prevByKey = new Map((previous ?? []).map((c) => [c.categoryId ?? c.name, c.total]));

  const slices = [...rows.map((c) => ({ name: c.name, value: c.total, color: c.color })), ...(rest > 0 ? [{ name: 'Outras', value: rest, color: 'hsl(var(--muted-foreground))' }] : [])];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição dos gastos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : sorted.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            Nenhuma despesa com categoria registrada neste mês.
          </div>
        ) : (
          <div className="grid items-center gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
            <div className="relative mx-auto h-52 w-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius={66} outerRadius={96} paddingAngle={2} cornerRadius={5} stroke="none">
                    {slices.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<SingleValueTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Gasto total</span>
                <span className="font-num text-xl font-bold">{formatCurrency(total)}</span>
              </div>
            </div>

            <ul className="divide-y divide-border/70">
              {rows.map((c) => {
                const prev = prevByKey.get(c.categoryId ?? c.name);
                const delta = prev != null && prev > 0 ? c.total - prev : null;
                const up = delta != null && delta > 0;
                return (
                  <li key={c.categoryId ?? c.name}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.categoryId ?? null)}
                      disabled={!c.categoryId}
                      className="group flex w-full items-center justify-between gap-3 py-2.5 text-left transition-theme enabled:hover:translate-x-0.5"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {((c.total / total) * 100).toFixed(1).replace('.', ',')}%
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-num text-sm font-semibold">{formatCurrency(c.total)}</span>
                        {delta != null ? (
                          <span
                            title={`${up ? 'Subiu' : 'Caiu'} ${formatCurrency(Math.abs(delta))} vs. mês anterior`}
                            className={cn('flex h-5 w-5 items-center justify-center rounded-md', up ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}
                          >
                            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          </span>
                        ) : (
                          <span className="h-5 w-5" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
              {rest > 0 && (
                <li className="flex items-center justify-between gap-3 py-2.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground" /> Outras
                  </span>
                  <span className="font-num mr-7 font-semibold">{formatCurrency(rest)}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
