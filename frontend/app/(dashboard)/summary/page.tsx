'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useBudgets } from '@/hooks/use-budgets';
import { useDashboardExpensesByCategory, useDashboardSummary, useGoalsSummary } from '@/hooks/use-dashboard';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Tx {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  category?: { name: string; color: string } | null;
}

function pctChange(current: number, previous: number | undefined) {
  if (previous == null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function Change({ pct, goodWhenUp = true }: { pct: number | null; goodWhenUp?: boolean }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">sem base no mês anterior</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold', good ? 'text-success' : 'text-danger')}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct)}% vs. mês anterior
    </span>
  );
}

export default function SummaryPage() {
  const now = new Date();
  const [cursor, setCursor] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const prev = new Date(cursor.year, cursor.month - 2, 1);
  const prevParams = { month: prev.getMonth() + 1, year: prev.getFullYear() };

  const { data: summary, isLoading: sumLoading } = useDashboardSummary(cursor);
  const { data: prevSummary } = useDashboardSummary(prevParams);
  const { data: categories, isLoading: catLoading } = useDashboardExpensesByCategory(cursor);
  const { data: prevCategories } = useDashboardExpensesByCategory(prevParams);
  const { data: budgets } = useBudgets(cursor.month, cursor.year);
  const { data: goals } = useGoalsSummary();

  const startDate = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-01`;
  const endDate = `${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(new Date(cursor.year, cursor.month, 0).getDate()).padStart(2, '0')}`;
  const { data: topExpenses, isLoading: txLoading } = useQuery({
    queryKey: ['summary', 'top-expenses', startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/transactions', { params: { type: 'EXPENSE', status: 'PAID', startDate, endDate, limit: 100 } });
      const raw = res.data;
      const list: Tx[] = Array.isArray(raw?.data?.items) ? raw.data.items : Array.isArray(raw?.items) ? raw.items : [];
      return list.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
    },
  });

  const income = summary?.totalIncome ?? 0;
  const expense = summary?.totalExpense ?? 0;
  const result = income - expense;
  const prevResult = prevSummary ? prevSummary.totalIncome - prevSummary.totalExpense : undefined;
  const savingRate = income > 0 ? Math.round((result / income) * 100) : null;

  const sortedCategories = useMemo(() => [...(categories ?? [])].filter((c) => c.total > 0).sort((a, b) => b.total - a.total), [categories]);
  const prevMap = useMemo(() => new Map((prevCategories ?? []).map((c) => [c.categoryId ?? c.name, c.total])), [prevCategories]);
  const budgetMap = useMemo(() => new Map((budgets ?? []).map((b) => [b.categoryId, b.amount])), [budgets]);
  const overBudget = sortedCategories.filter((c) => c.categoryId && budgetMap.has(c.categoryId) && c.total > (budgetMap.get(c.categoryId) as number));

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });

  // frases do fechamento (só o que os números sustentam)
  const highlights: string[] = [];
  if (income > 0 && savingRate != null) {
    highlights.push(savingRate >= 0 ? `Você guardou ${savingRate}% da renda do mês (${formatCurrency(result)}).` : `Os gastos passaram da renda em ${formatCurrency(-result)}.`);
  }
  const expChange = pctChange(expense, prevSummary?.totalExpense);
  if (expChange != null && Math.abs(expChange) >= 5) highlights.push(`As despesas ${expChange > 0 ? 'subiram' : 'caíram'} ${Math.abs(expChange)}% em relação ao mês anterior.`);
  if (sortedCategories[0] && expense > 0) highlights.push(`${sortedCategories[0].name} foi a categoria mais pesada: ${Math.round((sortedCategories[0].total / expense) * 100)}% dos gastos.`);
  if (overBudget.length > 0) highlights.push(`${overBudget.length === 1 ? 'Uma categoria passou' : `${overBudget.length} categorias passaram`} do orçamento: ${overBudget.map((c) => c.name).join(', ')}.`);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 print:max-w-none print:gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Resumo do mês</h1>
          <p className="mt-1 text-sm text-muted-foreground">O fechamento do mês em uma página — dá para salvar em PDF.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-soft">
            <button onClick={() => shift(-1)} aria-label="Mês anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-theme hover:bg-muted hover:text-foreground active:scale-90">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[9.5rem] text-center text-sm font-semibold">{MONTHS[cursor.month - 1]} de {cursor.year}</span>
            <button onClick={() => shift(1)} aria-label="Próximo mês" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-theme hover:bg-muted hover:text-foreground active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Salvar em PDF
          </Button>
        </div>
      </div>

      {/* cabeçalho que só aparece na impressão */}
      <div className="hidden print:block">
        <h1 className="font-display text-2xl font-bold">Resumo financeiro — {MONTHS[cursor.month - 1]} de {cursor.year}</h1>
        <p className="text-xs text-muted-foreground">Gerado em {new Date().toLocaleDateString('pt-BR')} pelo PouPay</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Receitas', value: income, prev: pctChange(income, prevSummary?.totalIncome), good: true, tone: 'text-success' },
          { label: 'Despesas', value: expense, prev: expChange, good: false, tone: 'text-danger' },
          { label: 'Resultado', value: result, prev: pctChange(result, prevResult), good: true, tone: result < 0 ? 'text-danger' : '' },
        ].map((k) => (
          <Card key={k.label} className="print:shadow-none">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              {sumLoading ? <Skeleton className="mt-2 h-9 w-36" /> : <p className={cn('font-num mt-1 text-3xl font-bold leading-tight', k.tone)}>{formatCurrency(k.value)}</p>}
              <div className="mt-1"><Change pct={k.prev} goodWhenUp={k.good} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {highlights.length > 0 && (
        <Card className="print:shadow-none">
          <CardHeader><CardTitle>Destaques</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed">
              {highlights.map((h) => (
                <li key={h} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{h}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <Card className="print:shadow-none">
          <CardHeader><CardTitle>Para onde foi o dinheiro</CardTitle></CardHeader>
          <CardContent>
            {catLoading ? <Skeleton className="h-48" /> : sortedCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa com categoria neste mês.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {sortedCategories.slice(0, 8).map((c) => {
                  const budget = c.categoryId ? (budgetMap.get(c.categoryId) as number | undefined) : undefined;
                  const before = prevMap.get(c.categoryId ?? c.name);
                  const delta = before ? pctChange(c.total, before) : null;
                  return (
                    <li key={c.categoryId ?? c.name}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} /><span className="truncate font-medium">{c.name}</span></span>
                        <span className="flex shrink-0 items-center gap-2">
                          {delta != null && Math.abs(delta) >= 5 && <span className={cn('text-[11px] font-bold', delta > 0 ? 'text-danger' : 'text-success')}>{delta > 0 ? '+' : ''}{delta}%</span>}
                          <span className="font-num font-bold">{formatCurrency(c.total)}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-1.5 rounded-full" style={{ width: `${(c.total / sortedCategories[0].total) * 100}%`, backgroundColor: c.color }} />
                      </div>
                      {budget != null && (
                        <p className={cn('mt-1 text-[11px]', c.total > budget ? 'font-semibold text-danger' : 'text-muted-foreground')}>
                          {c.total > budget ? `${formatCurrency(c.total - budget)} acima do orçamento de ${formatCurrency(budget)}` : `Dentro do orçamento (${formatCurrency(budget)})`}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="print:shadow-none">
          <CardHeader><CardTitle>Maiores despesas</CardTitle></CardHeader>
          <CardContent>
            {txLoading ? <Skeleton className="h-48" /> : !topExpenses || topExpenses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma despesa paga neste mês.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {topExpenses.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}{t.category ? ` · ${t.category.name}` : ''}</p>
                    </div>
                    <span className="font-num shrink-0 text-sm font-bold">{formatCurrency(Number(t.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {goals && goals.count > 0 && (
        <Card className="print:shadow-none">
          <CardHeader><CardTitle>Metas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Progresso geral: <strong className="text-foreground">{goals.overallProgress}%</strong> — {formatCurrency(goals.totalCurrent)} de {formatCurrency(goals.totalTarget)}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {goals.goals.map((g) => (
                <li key={g.id}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{g.name}</span><span className="font-num font-bold text-primary">{g.progress}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, g.progress)}%` }} /></div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
