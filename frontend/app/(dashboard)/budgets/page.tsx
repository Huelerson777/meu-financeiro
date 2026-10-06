'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
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
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: category.color }} />
          <span className="truncate text-sm font-semibold">{category.name}</span>
        </span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          orçamento R$
          <input
            inputMode="decimal"
            value={shown}
            placeholder="definir"
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="h-9 w-28 rounded-md border border-input bg-card px-2 text-right text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
      </div>

      {budget ? (
        <>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-2 rounded-full transition-all duration-500', st.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              Gasto <strong className="font-num text-foreground">{formatCurrency(spent)}</strong> de {formatCurrency(budget.amount)} · {Math.round(pct)}%
            </span>
            <span className={cn('font-semibold', st.text)}>
              {spent > budget.amount ? `${formatCurrency(spent - budget.amount)} acima` : `Restam ${formatCurrency(budget.amount - spent)}`}
              {st.label && ` · ${st.label}`}
            </span>
          </p>
        </>
      ) : (
        spent > 0 && <p className="mt-1 pl-5 text-xs text-muted-foreground">Gasto {formatCurrency(spent)} neste mês, sem orçamento definido.</p>
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
  const st = statusOf(totalPct);

  // categorias com orçamento ou gasto primeiro; o resto fica recolhido
  const relevant = categories.filter((c) => budgetMap.has(c.id) || (spentMap.get(c.id) ?? 0) > 0);
  const others = categories.filter((c) => !relevant.includes(c));
  const rows = [...relevant].sort((a, b) => (spentMap.get(b.id) ?? 0) - (spentMap.get(a.id) ?? 0));

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });

  const onSave = (categoryId: string) => (amount: number) =>
    save.mutate({ categoryId, amount }, { onError: () => notifyAlert('Não foi possível salvar o orçamento.') });

  const loading = catLoading || budLoading || spentLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Orçamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quanto você quer gastar em cada categoria e como o mês está indo.</p>
        </div>
        <div className="inline-flex items-center gap-1 self-start rounded-xl border border-border/70 bg-card p-1 shadow-soft">
          <button onClick={() => shift(-1)} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-theme hover:bg-muted hover:text-foreground active:scale-90">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold">
            {MONTHS[cursor.month - 1]} de {cursor.year}
          </span>
          <button onClick={() => shift(1)} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-theme hover:bg-muted hover:text-foreground active:scale-90">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : totalBudget > 0 ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Gasto nas categorias orçadas</p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className={cn('font-num text-3xl font-bold leading-none', totalPct >= 100 && 'text-danger')}>{formatCurrency(budgetedSpent)}</span>
                    <span className="text-sm text-muted-foreground">/ {formatCurrency(totalBudget)}</span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyPrevious.mutate(undefined, { onSuccess: (r: any) => !r?.copied && notifyAlert('Nada para copiar: o mês anterior não tem orçamento ou as categorias já estão preenchidas.') })} isLoading={copyPrevious.isPending}>
                  <Copy className="h-4 w-4" /> Copiar do mês anterior
                </Button>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-2.5 rounded-full transition-all duration-500', st.bar)} style={{ width: `${Math.min(100, totalPct)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {totalBudget - budgetedSpent >= 0 ? `Restam ${formatCurrency(totalBudget - budgetedSpent)} do orçamento do mês.` : `${formatCurrency(budgetedSpent - totalBudget)} acima do orçamento do mês.`}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Nenhum orçamento definido para este mês. Preencha o valor nas categorias abaixo, ou traga o do mês anterior.
              </p>
              <Button variant="outline" size="sm" onClick={() => copyPrevious.mutate(undefined, { onSuccess: (r: any) => !r?.copied && notifyAlert('Nada para copiar: o mês anterior não tem orçamento.') })} isLoading={copyPrevious.isPending}>
                <Copy className="h-4 w-4" /> Copiar do mês anterior
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
