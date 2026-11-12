'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { PaymentsStatus, PaymentsStatusItem } from '@/services/dashboard.service';

interface PaymentsStatusCardProps {
  status?: PaymentsStatus;
  isLoading: boolean;
  onPay: (item: PaymentsStatusItem) => void;
  /** Conta fixa que não existe neste mês (não volta a ser gerada). */
  onSkip?: (item: PaymentsStatusItem) => void;
}

const SOON_DAYS = 7;
const MAX_URGENT = 6;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "hoje", "amanhã", "em 3 dias", "há 2 dias" — mais fácil de ler que uma data solta. */
function relativeDue(iso: string) {
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff < 0) return `há ${-diff} dias`;
  if (diff <= SOON_DAYS) return `em ${diff} dias`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function Row({ item, onPay, onSkip }: { item: PaymentsStatusItem; onPay: PaymentsStatusCardProps['onPay']; onSkip?: PaymentsStatusCardProps['onSkip'] }) {
  const income = item.type === 'INCOME';
  const when = relativeDue(item.dueDate);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-9 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: item.category?.color ?? 'hsl(var(--border))' }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.description}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {item.isOverdue ? (
              // Receita "atrasada" não existe pro usuário: é dinheiro que ainda não entrou
              <span className={cn('font-semibold', income ? 'text-warning' : 'text-danger')}>
                {income ? `Não recebido · previsto ${when}` : `Atrasada · venceu ${when}`}
              </span>
            ) : (
              <>{income ? `A receber ${when}` : `Vence ${when}`}</>
            )}
            {' · '}
            {item.source}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className={cn('font-num text-sm font-semibold', income && 'text-success')}>
          {income ? '+ ' : ''}
          {formatCurrency(item.amount)}
        </span>
        {item.isRecurring && onSkip && (
          <button
            onClick={() => onSkip(item)}
            title="Não terei esta conta neste mês"
            className="hidden h-8 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground active:scale-95 sm:block"
          >
            Pular mês
          </button>
        )}
        <button
          onClick={() => onPay(item)}
          className="h-8 rounded-full bg-primary/10 px-3.5 text-xs font-bold text-primary transition-theme hover:bg-primary hover:text-primary-foreground active:scale-95"
        >
          {income ? 'Receber' : 'Pagar'}
        </button>
      </div>
    </li>
  );
}

/**
 * "Para fazer agora": o que pede ação no mês. Atrasadas e o que vence nos
 * próximos 7 dias aparecem direto, com Pagar/Receber na linha; o resto do mês
 * fica em "Ver o resto do mês". O progresso pago x em aberto vira uma linha só.
 */
export function PaymentsStatusCard({ status, isLoading, onPay, onSkip }: PaymentsStatusCardProps) {
  const [showAll, setShowAll] = useState(false);
  const paid = status?.paidExpenseTotal ?? 0;
  const open = status?.openExpenseTotal ?? 0;
  const total = paid + open;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const items = [...(status?.openItems ?? [])].sort(
    (a, b) => Number(b.isOverdue) - Number(a.isOverdue) || a.dueDate.localeCompare(b.dueDate),
  );
  const limit = startOfDay(new Date()) + SOON_DAYS * 86_400_000;
  const overdue = items.filter((i) => i.isOverdue);
  const soon = items.filter((i) => !i.isOverdue && startOfDay(new Date(i.dueDate)) <= limit);
  const urgent = [...overdue, ...soon];
  const later = items.filter((i) => !urgent.includes(i));
  const shownUrgent = showAll ? urgent : urgent.slice(0, MAX_URGENT);
  const hiddenCount = items.length - shownUrgent.length - (showAll ? later.length : 0);

  const overdueExpenses = overdue.filter((i) => i.type === 'EXPENSE').length;

  return (
    <Card id="para-fazer-agora" className="scroll-mt-24">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-1 space-y-0">
        <div>
          <CardTitle>Para fazer agora</CardTitle>
          {!isLoading && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {items.length === 0
                ? 'Nada pendente neste mês.'
                : [
                    overdueExpenses > 0 && <span key="o" className="font-semibold text-danger">{overdueExpenses} {overdueExpenses === 1 ? 'atrasada' : 'atrasadas'}</span>,
                    soon.length > 0 && <span key="s">{soon.length} nos próximos {SOON_DAYS} dias</span>,
                    later.length > 0 && <span key="l">{later.length} mais adiante</span>,
                  ]
                    .filter(Boolean)
                    .flatMap((el, i) => (i === 0 ? [el] : [<span key={`d${i}`}> · </span>, el]))}
            </p>
          )}
        </div>
        {!isLoading && total > 0 && (
          <div className="w-full sm:w-56">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>Contas do mês pagas</span>
              <span className="font-num font-semibold text-foreground">{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
              <div className="h-1.5 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatCurrency(paid)} pagos · {formatCurrency(open)} em aberto
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Tudo em dia neste mês.
          </p>
        ) : (
          <>
            {urgent.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">
                Nada vence nos próximos {SOON_DAYS} dias.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {shownUrgent.map((item) => (
                  <Row key={item.id} item={item} onPay={onPay} onSkip={onSkip} />
                ))}
              </ul>
            )}

            {showAll && later.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">Mais adiante neste mês</p>
                <ul className="divide-y divide-border/60">
                  {later.map((item) => (
                    <Row key={item.id} item={item} onPay={onPay} onSkip={onSkip} />
                  ))}
                </ul>
              </>
            )}

            {(hiddenCount > 0 || showAll) && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 w-full rounded-full py-2 text-center text-sm font-semibold text-primary transition-theme hover:bg-primary/10"
              >
                {showAll ? 'Mostrar menos' : `Ver o resto do mês (${hiddenCount})`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
