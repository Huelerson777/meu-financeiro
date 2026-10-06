'use client';

import { useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { PaymentsStatus, PaymentsStatusItem } from '@/services/dashboard.service';

interface PaymentsStatusCardProps {
  status?: PaymentsStatus;
  isLoading: boolean;
  onPay: (item: PaymentsStatusItem) => void;
}

const VISIBLE = 6;

/** Pago x em aberto no mês: barra de progresso, os dois totais e a lista do que falta, com ação direta. */
export function PaymentsStatusCard({ status, isLoading, onPay }: PaymentsStatusCardProps) {
  const [showAll, setShowAll] = useState(false);
  const paid = status?.paidExpenseTotal ?? 0;
  const open = status?.openExpenseTotal ?? 0;
  const total = paid + open;
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const items = status?.openItems ?? [];
  const shown = showAll ? items : items.slice(0, VISIBLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pago x Em Aberto</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Pago no mês</p>
                  <p className="font-num text-xl font-bold">{formatCurrency(paid)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <Clock className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Em aberto no mês</p>
                  <p className="font-num text-xl font-bold">{formatCurrency(open)}</p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="h-2.5 overflow-hidden rounded-full bg-warning/20">
                <div className="h-2.5 rounded-full bg-success transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {total > 0 ? `${pct}% das despesas do mês já foram pagas` : 'Sem despesas previstas neste mês'}
              </p>
            </div>

            {items.length === 0 ? (
              <p className="mt-6 rounded-xl bg-success/10 px-4 py-6 text-center text-sm font-medium text-success">
                Nada em aberto neste mês — tudo pago.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-border/70">
                {shown.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-9 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: item.category?.color ?? 'hsl(var(--border))' }}
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{item.description}</span>
                          {item.isOverdue && (
                            <span className="shrink-0 rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-danger">Atrasada</span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          vence {new Date(item.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {item.source}
                          {item.category && <span style={{ color: item.category.color }}> · {item.category.name}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={cn('font-num text-sm font-bold', item.type === 'INCOME' && 'text-success')}>
                        {item.type === 'INCOME' ? '+ ' : ''}
                        {formatCurrency(item.amount)}
                      </span>
                      <button
                        onClick={() => onPay(item)}
                        className="h-8 rounded-md bg-primary/10 px-3 text-xs font-bold text-primary transition-theme hover:bg-primary hover:text-primary-foreground active:scale-95"
                      >
                        {item.type === 'INCOME' ? 'Receber' : 'Pagar'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {items.length > VISIBLE && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 w-full rounded-md py-2 text-center text-sm font-semibold text-primary transition-theme hover:bg-primary/10"
              >
                {showAll ? 'Mostrar menos' : `Ver todas (${items.length})`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
