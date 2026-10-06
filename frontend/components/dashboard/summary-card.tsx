import { LucideIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface SummaryCardProps {
  label: string;
  value?: number;
  icon: LucideIcon;
  isLoading?: boolean;
  tone?: 'default' | 'success' | 'danger';
  onClick?: () => void;
  /** Variação percentual vs. período anterior. Positivo bom nem sempre é positivo (ex: despesa) — use invertChangeTone. */
  changePct?: number | null;
  /** Se true, uma alta (%) é ruim e uma queda é boa — usado em cards de despesa. */
  invertChangeTone?: boolean;
  /** Texto após o percentual. Padrão: "vs. mês anterior". */
  compareLabel?: string;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  isLoading,
  tone = 'default',
  onClick,
  changePct,
  invertChangeTone,
  compareLabel = 'vs. mês anterior',
}: SummaryCardProps) {
  const isGoodChange = changePct != null && (invertChangeTone ? changePct < 0 : changePct > 0);
  const isBadChange = changePct != null && (invertChangeTone ? changePct > 0 : changePct < 0);

  return (
    <Card
      className={cn('transition-theme hover:-translate-y-0.5 hover:shadow-lift', onClick && 'cursor-pointer hover:border-primary/40')}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {isLoading ? (
            <Skeleton className="h-7 w-28" />
          ) : (
            <>
              <span
                className={cn(
                  'font-num text-[1.75rem] font-bold leading-tight',
                  tone === 'success' && 'text-success',
                  tone === 'danger' && 'text-danger',
                )}
              >
                {formatCurrency(value ?? 0)}
              </span>
              {changePct != null && (
                <span
                  className={cn(
                    'inline-flex w-fit items-center gap-0.5 text-xs font-medium',
                    isGoodChange && 'text-success',
                    isBadChange && 'text-danger',
                    !isGoodChange && !isBadChange && 'text-muted-foreground',
                  )}
                >
                  {changePct > 0 ? <ArrowUp className="h-3 w-3" /> : changePct < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                  {Math.abs(changePct)}% {compareLabel}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  );
}