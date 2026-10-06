import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface ResultCardProps {
  income: number;
  expense: number;
  invested: number;
  result: number;
  previousResult?: number;
  isLoading: boolean;
}

function Line({ icon: Icon, label, value, tone, share }: { icon: typeof TrendingUp; label: string; value: number; tone: string; share: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className={cn('h-4 w-4', tone)} strokeWidth={1.75} />
          {label}
        </span>
        <span className="font-num text-sm font-bold">{formatCurrency(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-1.5 rounded-full transition-all', tone.replace('text-', 'bg-'))} style={{ width: `${Math.min(100, Math.max(share, value > 0 ? 3 : 0))}%` }} />
      </div>
    </div>
  );
}

/** "Resultado" do mês: saldo em destaque, variação vs. mês anterior e quanto da receita foi para gastos e investimentos. */
export function ResultCard({ income, expense, invested, result, previousResult, isLoading }: ResultCardProps) {
  const hasPrev = previousResult != null && previousResult !== 0;
  const pct = hasPrev ? Math.round(((result - previousResult!) / Math.abs(previousResult!)) * 100) : null;
  const up = pct != null && pct >= 0;
  const base = Math.max(income, expense + invested, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado do mês</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('font-num text-4xl font-bold leading-none', result < 0 && 'text-danger')}>{formatCurrency(result)}</span>
              {pct != null && (
                <span className={cn('inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-bold', up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                  {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(pct)}%
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {hasPrev ? `vs ${formatCurrency(previousResult!)} no mês anterior` : 'Sem resultado no mês anterior para comparar.'}
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <Line icon={TrendingUp} label="Receitas" value={income} tone="text-success" share={(income / base) * 100} />
              <Line icon={TrendingDown} label="Despesas" value={expense} tone="text-danger" share={(expense / base) * 100} />
              <Line icon={PiggyBank} label="Investido" value={invested} tone="text-primary" share={(invested / base) * 100} />
            </div>

            <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
              Considera apenas o que já foi pago ou recebido no mês. A variação compara com o mês anterior inteiro, então no começo do mês ela tende a oscilar mais.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
