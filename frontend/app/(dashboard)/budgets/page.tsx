'use client';

import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useBudgetMutations, useBudgets } from '@/hooks/use-budgets';
import { useDashboardExpensesByCategory } from '@/hooks/use-dashboard';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { notifyAlert } from '@/utils/notify';
import { cn } from '@/utils/cn';
import { Ring } from '@/components/ui/ring';
import { Story, Dim } from '@/components/ui/story';
import { Money } from '@/components/dashboard/month-story';
import { MonthSwitcher } from '@/components/ui/month-switcher';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface CategoryItem {
  id: string;
  name: string;
  color: string;
}

function listOf(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  return [];
}

function statusOf(pct: number) {
  if (pct >= 100) return { bar: 'bg-danger', text: 'text-danger', label: 'Estourou' };
  if (pct >= 80) return { bar: 'bg-warning', text: 'text-warning', label: 'Quase no limite' };
  return { bar: 'bg-primary', text: 'text-muted-foreground', label: '' };
}

function BudgetRow({
  category, spent, budget, onSave, onClear,
}: {
  category: CategoryItem;
  spent: number;
  budget?: { id: string; amount: number };
  onSave: (amount: number) => void;
  onClear: (id: string) => void;
}) {
  const [value, setValue] = useState<string | null>(null); // null = mostrando o valor salvo
  const shown = value ?? (budget ? String(budget.amount).replace('.', ',') : '');
  const pct = budget ? (spent / budget.amount) * 100 : 0;
  const st = statusOf(pct);

  const commit = () => {
    if (value == null) return;
    const n = Number(value.replace(/\./g, '').replace(',', '.'));
    if (value.trim() === '') {
      if (budget) onClear(budget.id);
    } else if (Number.isFinite(n) && n > 0 && n !== budget?.amount) {
      onSave(n);
    }
    setValue(null);
  };

  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          {budget ? (
            <Ring value={pct / 100} size={40} thickness={4} warnAt={0.8} dangerAt={1} aria-label={`${Math.round(pct)}% do orçamento`}>
              <span className="font-num text-[10px] font-semibold">{Math.round(pct)}%</span>
            </Ring>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
            </span>
          )}
          <span className="truncate text-sm font-semibold">{category.name}</span>
        </span>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="sr-only sm:not-sr-only">orçamento R$</span>
          <input
            inputMode="decimal"
            value={shown}
            placeholder="definir"
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            aria-label={`Orçamento de ${category.name} (R$)`}
            className="h-9 w-24 rounded-full sm:w-28 border border-input bg-card px-3 text-right text-sm font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </label>
      </div>

      {budget ? (
        <>
          <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 pl-[3.25rem] text-xs">
            <span className="text-muted-foreground">
              Gasto <strong className="font-num text-foreground">{formatCurrency(spent)}</strong> de {formatCurrency(budget.amount)}
            </span>
            <span className={cn('font-semibold', st.text)}>
              {spent > budget.amount ? `${formatCurrency(spent - budget.amount)} acima` : `Restam ${formatCurrency(budget.amount - spent)}`}
              {st.label && ` · ${st.label}`}
            </span>
          </p>
        </>
      ) : (
        spent > 0 && <p className="mt-1 pl-[3.25rem] text-xs text-muted-foreground">Gasto {formatCurrency(spent)} neste mês, sem orçamento definido.</p>
      )}
    </li>
  );
}

export default function BudgetsPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [showAll, setShowAll] = useState(false);

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => listOf(r.data) as CategoryItem[]).catch(() => [] as CategoryItem[]),
  });
  const { data: budgets = [], isLoading: budLoading } = useBudgets(cursor.month, cursor.year);
  const { data: spentByCategory, isLoading: spentLoading } = useDashboardExpensesByCategory(cursor);
  const { save, remove, copyPrevious } = useBudgetMutations(cursor.month, cursor.year);

  const spentMap = useMemo(() => new Map((spentByCategory ?? []).map((c) => [c.categoryId ?? '', c.total])), [spentByCategory]);
  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const budgetedSpent = budgets.reduce((s, b) => s + (spentMap.get(b.categoryId) ?? 0), 0);
  const totalPct = totalBudget > 0 ? (budgetedSpent / totalBudget) * 100 : 0;

  // categorias com orçamento ou gasto primeiro; o resto fica recolhido
  const relevant = categories.filter((c) => budgetMap.has(c.id) || (spentMap.get(c.id) ?? 0) > 0);
  const others = categories.filter((c) => !relevant.includes(c));
  const rows = [...relevant].sort((a, b) => (spentMap.get(b.id) ?? 0) - (spentMap.get(a.id) ?? 0));


  const onSave = (categoryId: string) => (amount: number) =>
    save.mutate({ categoryId, amount }, { onError: () => notifyAlert('Não foi possível salvar o orçamento.') });

  const loading = catLoading || budLoading || spentLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="font-display text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">Orçamento</h1>
        <MonthSwitcher month={cursor.month} year={cursor.year} onChange={(month, year) => setCursor({ month, year })} />
      </div>

      {/* Resumo contado + anel do total, sem cartão */}
      {loading ? (
        <Skeleton className="h-28 rounded-[1.75rem]" />
      ) : totalBudget > 0 ? (
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
          <Ring value={totalPct / 100} size={112} thickness={9} warnAt={0.8} dangerAt={1} aria-label={`${Math.round(totalPct)}% do orçamento usado`}>
            <span className="font-num text-2xl font-bold leading-none">{Math.round(totalPct)}%</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">usado</span>
          </Ring>
          <div className="flex min-w-0 flex-col gap-3">
            <Story>
              Você gastou <Money value={budgetedSpent} className={cn(totalPct >= 100 && 'text-danger')} /> <Dim>dos</Dim> <Money value={totalBudget} />{' '}
              <Dim>planejados.</Dim>{' '}
              {totalBudget - budgetedSpent >= 0 ? (
                <>
                  <Dim>Restam</Dim> <Money value={totalBudget - budgetedSpent} className="text-primary" />
                  <Dim>.</Dim>
                </>
              ) : (
                <>
                  <Money value={budgetedSpent - totalBudget} className="text-danger" /> <Dim>acima.</Dim>
                </>
              )}
            </Story>
            <Button variant="ghost" size="sm" className="w-fit px-3" onClick={() => copyPrevious.mutate(undefined, { onSuccess: (r: any) => !r?.copied && notifyAlert('Nada para copiar: o mês anterior não tem orçamento ou as categorias já estão preenchidas.') })} isLoading={copyPrevious.isPending}>
              <Copy className="h-4 w-4" /> Copiar do mês anterior
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <Story>
            Nenhum orçamento em {MONTHS[cursor.month - 1].toLowerCase()}. <Dim>Defina quanto quer gastar em cada categoria abaixo.</Dim>
          </Story>
          <Button variant="outline" size="sm" onClick={() => copyPrevious.mutate(undefined, { onSuccess: (r: any) => !r?.copied && notifyAlert('Nada para copiar: o mês anterior não tem orçamento.') })} isLoading={copyPrevious.isPending}>
            <Copy className="h-4 w-4" /> Copiar do mês anterior
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Categorias</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada. Crie categorias em Configurações.</p>
          ) : (
            <>
              <ul className="divide-y divide-border/70">
                {rows.map((c) => (
                  <BudgetRow key={c.id} category={c} spent={spentMap.get(c.id) ?? 0} budget={budgetMap.get(c.id)} onSave={onSave(c.id)} onClear={(id) => remove.mutate(id)} />
                ))}
              </ul>
              {others.length > 0 && (
                <>
                  <button onClick={() => setShowAll((v) => !v)} className="mt-2 w-full rounded-md py-2 text-center text-sm font-semibold text-primary transition-theme hover:bg-primary/10">
                    {showAll ? 'Ocultar outras categorias' : `Outras categorias (${others.length})`}
                  </button>
                  {showAll && (
                    <ul className="divide-y divide-border/70">
                      {others.map((c) => (
                        <BudgetRow key={c.id} category={c} spent={0} onSave={onSave(c.id)} onClear={(id) => remove.mutate(id)} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
