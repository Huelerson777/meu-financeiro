'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock, CreditCard, Repeat, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartTooltip } from '@/components/dashboard/chart-tooltips';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

export interface OverviewBill {
  id: string;
  description: string;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
  defaultAmount: number | string | null;
  dueDay: number;
  type?: 'EXPENSE' | 'INCOME';
  isActive: boolean;
}

export interface OverviewPurchase {
  installmentGroupId: string;
  description: string;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
  totalCount: number;
  items: { number: number | null; amount: number; dueDate: string; paid: boolean }[];
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function sameMonth(iso: string, month: number, year: number) {
  const d = new Date(iso);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

interface IncomePattern {
  description: string;
  months: number;
  average: number;
  day: number;
  last: string;
}

/** Receitas que se repetem em 2+ meses nos últimos 4 meses (mesma descrição) viram "recorrentes detectadas". */
function detectIncomePatterns(transactions: { description: string; amount: number | string; date: string }[]): IncomePattern[] {
  const groups = new Map<string, { description: string; items: { amount: number; date: Date }[] }>();
  transactions.forEach((t) => {
    const key = t.description.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { description: t.description.trim(), items: [] });
    groups.get(key)!.items.push({ amount: num(t.amount), date: new Date(t.date) });
  });

  const patterns: IncomePattern[] = [];
  groups.forEach(({ description, items }) => {
    const monthKeys = new Set(items.map((i) => `${i.date.getFullYear()}-${i.date.getMonth()}`));
    if (monthKeys.size < 2) return;
    const days = items.map((i) => i.date.getDate()).sort((a, b) => a - b);
    const sorted = [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
    patterns.push({
      description,
      months: monthKeys.size,
      average: items.reduce((s, i) => s + i.amount, 0) / monthKeys.size,
      day: days[Math.floor(days.length / 2)],
      last: sorted[0].date.toISOString(),
    });
  });
  return patterns.sort((a, b) => b.average - a.average);
}

function useDetectedIncome(enabled: boolean) {
  const [state, setState] = useState<{ loading: boolean; patterns: IncomePattern[] }>({ loading: true, patterns: [] });

  useEffect(() => {
    if (!enabled) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const iso = (d: Date) => d.toISOString().split('T')[0];
    api
      .get('/transactions', { params: { type: 'INCOME', status: 'PAID', startDate: iso(start), endDate: iso(now), limit: 100 } })
      .then((res) => {
        const raw = res.data;
        const list = Array.isArray(raw?.data?.items) ? raw.data.items : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
        setState({ loading: false, patterns: detectIncomePatterns(list) });
      })
      .catch(() => setState({ loading: false, patterns: [] }));
  }, [enabled]);

  return state;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Repeat; label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-3 text-sm">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', tone ?? 'bg-muted text-muted-foreground')}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        {label}
      </span>
      <span className="font-num text-base font-bold">{formatCurrency(value)}</span>
    </div>
  );
}

export function RecurringOverview({ bills, purchases, loading, onAddIncome }: { bills: OverviewBill[]; purchases: OverviewPurchase[]; loading: boolean; onAddIncome?: () => void }) {
  const now = new Date();
  const [kind, setKind] = useState<'expenses' | 'income'>('expenses');
  const [cursor, setCursor] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  const income = useDetectedIncome(kind === 'income');

  const activeBills = useMemo(() => bills.filter((b) => b.isActive && b.type !== 'INCOME'), [bills]);
  const incomeBills = useMemo(() => bills.filter((b) => b.isActive && b.type === 'INCOME'), [bills]);
  const registeredIncomeTotal = incomeBills.reduce((s, b) => s + num(b.defaultAmount), 0);
  const registeredNames = new Set(incomeBills.map((b) => b.description.trim().toLowerCase()));
  const detected = income.patterns.filter((p) => !registeredNames.has(p.description.trim().toLowerCase()));
  const fixedTotal = activeBills.reduce((s, b) => s + num(b.defaultAmount), 0);
  const variableCount = activeBills.filter((b) => b.defaultAmount == null).length;

  const installmentsOf = (month: number, year: number) =>
    purchases.flatMap((p) =>
      p.items
        .filter((i) => sameMonth(i.dueDate, month, year))
        .map((i) => ({ ...i, description: p.description, totalCount: p.totalCount, category: p.category, account: p.account, key: `${p.installmentGroupId}-${i.number}` })),
    );

  const chart = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const inst = installmentsOf(d.getMonth() + 1, d.getFullYear()).reduce((s, x) => s + x.amount, 0);
        return { label: `${MONTH_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, month: d.getMonth() + 1, year: d.getFullYear(), Parcelas: inst, 'Contas fixas': fixedTotal };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purchases, fixedTotal],
  );

  const monthInstallments = installmentsOf(cursor.month, cursor.year).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const installmentsTotal = monthInstallments.reduce((s, x) => s + x.amount, 0);
  const installmentsPaid = monthInstallments.filter((x) => x.paid).reduce((s, x) => s + x.amount, 0);
  const total = fixedTotal + installmentsTotal;

  const byAccount = useMemo(() => {
    const map = new Map<string, number>();
    activeBills.forEach((b) => map.set(b.account?.name ?? 'Escolher ao pagar', (map.get(b.account?.name ?? 'Escolher ao pagar') ?? 0) + num(b.defaultAmount)));
    monthInstallments.forEach((x) => map.set(x.account?.name ?? 'Escolher ao pagar', (map.get(x.account?.name ?? 'Escolher ao pagar') ?? 0) + x.amount));
    return [...map.entries()].map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  }, [activeBills, monthInstallments]);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });

  const incomeTotal = detected.reduce((s, p) => s + p.average, 0);

  return (
    <section className="mb-10 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" className="inline-flex self-start rounded-xl bg-muted p-1">
          {([
            ['expenses', 'Despesas', TrendingDown],
            ['income', 'Receitas', TrendingUp],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={kind === key}
              onClick={() => setKind(key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-theme active:scale-[0.97]',
                kind === key ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {kind === 'expenses' && (
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
        )}
      </div>

      {kind === 'expenses' ? (
        loading ? (
          <Skeleton className="h-72 rounded-xl" />
        ) : (
          <>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Próximos 6 meses</CardTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Parcelas</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Contas fixas</span>
                </div>
              </CardHeader>
              <CardContent className="h-56 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chart}
                    margin={{ top: 8, left: 4, right: 8 }}
                    onClick={(e: any) => {
                      const p = e?.activePayload?.[0]?.payload;
                      if (p) setCursor({ month: p.month, year: p.year });
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}mil` : String(v))} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Bar dataKey="Contas fixas" stackId="a" fill="hsl(var(--primary))" cursor="pointer" />
                    <Bar dataKey="Parcelas" stackId="a" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{MONTHS[cursor.month - 1]} de {cursor.year}</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    <Stat icon={CreditCard} label="Parcelas" value={installmentsTotal} tone="bg-warning/10 text-warning" />
                    <Stat icon={Repeat} label="Contas fixas" value={fixedTotal} tone="bg-primary/10 text-primary" />
                    <div className="flex items-center justify-between py-2.5 text-sm font-semibold">
                      <span>Total no mês</span>
                      <span className="font-num text-lg font-bold">{formatCurrency(total)}</span>
                    </div>
                    {installmentsTotal > 0 && (
                      <div className="py-2.5 text-xs text-muted-foreground">
                        Parcelas já pagas: <strong className="text-foreground">{formatCurrency(installmentsPaid)}</strong> de {formatCurrency(installmentsTotal)}
                        {variableCount > 0 && <> · {variableCount} conta(s) fixa(s) de valor variável não somam.</>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Gasto por conta</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {byAccount.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma recorrência prevista neste mês.</p>
                    ) : (
                      byAccount.map((a) => (
                        <div key={a.name}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="truncate">{a.name}</span>
                            <span className="font-num font-semibold">{formatCurrency(a.value)}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(a.value / (byAccount[0]?.value || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="grid gap-8 p-5 md:grid-cols-2">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Repeat className="h-4 w-4 text-primary" strokeWidth={1.75} /> Contas fixas ({activeBills.length})
                    </p>
                    {activeBills.length === 0 ? (
                      <p className="py-6 text-sm text-muted-foreground">Nenhuma conta fixa ativa.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {[...activeBills].sort((a, b) => a.dueDay - b.dueDay).map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{b.description}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarClock className="h-3 w-3" /> dia {b.dueDay}
                                {b.category && <span style={{ color: b.category.color }}>· {b.category.name}</span>}
                              </p>
                            </div>
                            <span className="font-num shrink-0 text-sm font-semibold">{b.defaultAmount != null ? formatCurrency(num(b.defaultAmount)) : 'variável'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <CreditCard className="h-4 w-4 text-warning" strokeWidth={1.75} /> Parcelas ({monthInstallments.length})
                    </p>
                    {monthInstallments.length === 0 ? (
                      <p className="py-6 text-sm text-muted-foreground">Nenhuma parcela vence neste mês.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {monthInstallments.map((x) => (
                          <li key={x.key} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{x.description}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {x.number}/{x.totalCount} · vence {new Date(x.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                {x.paid && <span className="ml-1.5 font-semibold text-success">· paga</span>}
                              </p>
                            </div>
                            <span className={cn('font-num shrink-0 text-sm font-semibold', x.paid && 'text-muted-foreground line-through')}>{formatCurrency(x.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-end justify-between space-y-0">
              <div>
                <CardTitle>Receitas recorrentes cadastradas</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Entram todo mês como "a receber" e alimentam a Projeção.</p>
              </div>
              <div className="flex items-end gap-4">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Por mês</p>
                  <p className="font-num text-2xl font-bold text-success">{formatCurrency(registeredIncomeTotal)}</p>
                </div>
                {onAddIncome && (
                  <button
                    onClick={onAddIncome}
                    className="h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen"
                  >
                    + Nova receita
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {incomeBills.length === 0 ? (
                <p className="py-6 text-sm leading-relaxed text-muted-foreground">
                  Nenhuma receita recorrente cadastrada. Cadastre seu salário (ou outra entrada fixa) e ele passa a aparecer todo mês em "Em aberto" para você confirmar o recebimento.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {[...incomeBills].sort((a, b) => a.dueDay - b.dueDay).map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{b.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          todo dia {b.dueDay}
                          {b.account?.name ? ` · ${b.account.name}` : ''}
                        </p>
                      </div>
                      <span className="font-num shrink-0 text-base font-bold text-success">
                        {b.defaultAmount != null ? formatCurrency(num(b.defaultAmount)) : 'variável'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {income.loading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            detected.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-end justify-between space-y-0">
                  <div>
                    <CardTitle>Detectadas pelo histórico</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Mesma descrição em 2+ dos últimos 4 meses, ainda não cadastradas como recorrentes.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Estimativa por mês</p>
                    <p className="font-num text-xl font-bold">{formatCurrency(incomeTotal)}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-border">
                    {detected.map((p) => (
                      <li key={p.description} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.description}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            costuma cair por volta do dia {p.day} · visto em {p.months} meses
                          </p>
                        </div>
                        <span className="font-num shrink-0 text-base font-bold text-success">{formatCurrency(p.average)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          )}
        </>
      )}
    </section>
  );
}
