import { LucideIcon, ArrowUp, ArrowDown, ArrowUpRight } from 'lucide-react';
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

/**
 * Indicador do mês sem caixa: rótulo, número e variação direto no fundo da
 * página, separados só por uma linha fina à esquerda. Lado a lado, os quatro
 * leem como uma faixa contínua em vez de quatro cartões iguais.
 */
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
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick, title: `Ver ${label.toLowerCase()} do mês` } : {})}
      className={cn(
        'group/stat flex h-full w-full flex-col gap-1.5 border-l border-border py-1 pl-4 text-left transition-theme',
        onClick && 'cursor-pointer hover:border-primary focus-visible:outline-none focus-visible:border-primary',
      )}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
        {label}
        {onClick && (
          <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover/stat:translate-x-0 group-hover/stat:opacity-100 group-focus-visible/stat:translate-x-0 group-focus-visible/stat:opacity-100" />
        )}
      </span>
      {isLoading ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <>
          <span
            className={cn(
              'font-num text-[1.35rem] font-semibold leading-tight sm:text-[1.7rem]',
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
              {Math.abs(changePct)}% <span className="font-normal text-muted-foreground">{compareLabel}</span>
            </span>
          )}
        </>
      )}
    </Wrapper>
  );
}
