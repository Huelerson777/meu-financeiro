'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Gauge, PieChart, Pencil, Receipt, Sparkles,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import { Area, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface InsightsHeroProps {
  isLoading: boolean;
  month: number;
  year: number;
  income: number;
  expense: number;
  leftovers: number;
  openExpenseTotal: number;
  openExpenseCount: number;
  overdueCount: number;
  nextDue?: { description: string; dueDate: string; amount: number } | null;
  expenseChangePct?: number | null;
  topCategory?: { name: string; total: number } | null;
  limit: number | null;
  /** Categoria que mais passou do orçamento no mês, se alguma passou. */
  budgetAlert?: { name: string; over: number; pct: number } | null;
  onChangeLimit: (value: number | null) => void;
  /** Despesas pagas por dia do mês (série diária do fluxo de caixa). */
  dailyExpenses?: { key: string; despesas: number }[];
}

type Tone = 'good' | 'bad' | 'neutral';

interface Insight {
  icon: typeof Sparkles;
  tone: Tone;
  title: string;
  text: string;
}

function buildInsights(p: InsightsHeroProps): Insight[] {
  const list: Insight[] = [];
  const now = new Date();
  const isCurrentMonth = now.getMonth() + 1 === p.month && now.getFullYear() === p.year;
  const daysInMonth = new Date(p.year, p.month, 0).getDate();

  if (p.overdueCount > 0) {
    list.push({
      icon: AlertTriangle,
      tone: 'bad',
      title: `${p.overdueCount} ${p.overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'}`,
      text: 'Regularize para evitar juros e multa.',
    });
  }

  if (p.budgetAlert) {
    list.push({
      icon: AlertTriangle,
      tone: 'bad',
      title: `${p.budgetAlert.name} passou do orçamento`,
      text: `${formatCurrency(p.budgetAlert.over)} acima do planejado (${p.budgetAlert.pct}% do valor definido).`,
    });
  }

  if (p.limit && isCurrentMonth) {
    const pace = p.limit * (now.getDate() / daysInMonth);
    const diff = pace - p.expense;
    list.push({
      icon: Gauge,
      tone: diff >= 0 ? 'good' : 'bad',
      title: diff >= 0 ? `${formatCurrency(diff)} abaixo do ritmo do limite` : `${formatCurrency(-diff)} acima do ritmo do limite`,
      text:
        diff >= 0
          ? 'Mantenha esse ritmo e o mês fecha com dinheiro sobrando.'
          : `Pelo limite de ${formatCurrency(p.limit)}, o gasto até hoje deveria estar em ${formatCurrency(pace)}.`,
    });
  }

  if (p.income > 0) {
    // quanto da renda do mês não foi gasto (receitas - despesas), não o saldo acumulado das contas
    const rate = Math.round(((p.income - p.expense) / p.income) * 100);
    list.push({
      icon: Sparkles,
      tone: rate >= 20 ? 'good' : rate >= 0 ? 'neutral' : 'bad',
      title: rate >= 0 ? `Você guardou ${rate}% da renda` : `Gastos ${Math.abs(rate)}% acima da renda`,
      text:
        rate >= 20
          ? 'Acima dos 20% que costumam ser a referência.'
          : rate >= 0
            ? 'A referência comum é guardar ao menos 20%.'
            : 'As saídas já passaram do que entrou no mês.',
    });
  }

  if (p.expenseChangePct != null && p.expenseChangePct !== 0) {
    const up = p.expenseChangePct > 0;
    list.push({
      icon: up ? TrendingUp : TrendingDown,
      tone: up ? 'bad' : 'good',
      title: `Despesas ${up ? 'subiram' : 'caíram'} ${Math.abs(p.expenseChangePct)}%`,
      text: 'Em relação ao mês anterior.',
    });
  }

  if (p.topCategory && p.expense > 0) {
    const share = Math.round((p.topCategory.total / p.expense) * 100);
    list.push({
      icon: PieChart,
      tone: 'neutral',
      title: `${p.topCategory.name} lidera: ${share}%`,
      text: `${formatCurrency(p.topCategory.total)} do total gasto no mês.`,
    });
  }

  if (isCurrentMonth && p.expense > 0) {
    const day = now.getDate();
    const projected = (p.expense / day) * daysInMonth;
    list.push({
      icon: CalendarClock,
      tone: p.income > 0 && projected > p.income ? 'bad' : 'neutral',
      title: `Ritmo: ${formatCurrency(p.expense / day)}/dia`,
      text: `Neste ritmo o mês fecha perto de ${formatCurrency(projected)} em despesas.`,
    });
  }

  return list.slice(0, 6);
}

/** Faixa de dicas no pé do card principal — troca sozinha, pausa com o mouse em cima. */
function TipsStrip({ insights, isLoading }: { insights: Insight[]; isLoading: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = insights.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => clearInterval(id);
  }, [count, paused]);

  const current = Math.min(index, Math.max(count - 1, 0));
  const tip = insights[current];
  const go = (delta: number) => setIndex((i) => (Math.min(i, count - 1) + delta + count) % count);

  return (
    <div
      className="border-t border-primary/15 bg-primary/[0.07] px-5 py-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        Dica do PouPay
      </p>
      {isLoading ? (
        <Skeleton className="mt-2 h-10" />
      ) : !tip ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Lance receitas e despesas deste mês para começar a ver leituras sobre o seu dinheiro.
        </p>
      ) : (
        <div key={current} className="mt-1.5 flex min-h-[2.75rem] animate-fade-in items-start gap-2.5">
          <tip.icon className={cn('mt-0.5 h-4 w-4 shrink-0', toneIcon[tip.tone])} strokeWidth={1.9} />
          <p className="text-sm leading-relaxed">
            <span className="font-semibold">{tip.title}.</span> <span className="text-muted-foreground">{tip.text}</span>
          </p>
        </div>
      )}
      {count > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1.5" role="tablist" aria-label="Dicas">
            {insights.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Dica ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn('h-1.5 rounded-full bg-primary transition-all', i === current ? 'w-5' : 'w-1.5 opacity-30 hover:opacity-60')}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={() => go(-1)} aria-label="Dica anterior" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-primary/10 hover:text-foreground active:scale-90">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(1)} aria-label="Próxima dica" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-primary/10 hover:text-foreground active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const toneIcon: Record<Tone, string> = {
  good: 'text-success',
  bad: 'text-danger',
  neutral: 'text-warning',
};

/** Gasto acumulado no mês (linha cheia) contra o ritmo ideal do limite (tracejada). */
function PaceChart({ p }: { p: InsightsHeroProps }) {
  const now = new Date();
  const isCurrent = now.getMonth() + 1 === p.month && now.getFullYear() === p.year;
  const isFuture = new Date(p.year, p.month - 1, 1) > now;
  const daysInMonth = new Date(p.year, p.month, 0).getDate();
  const lastDay = isFuture ? 0 : isCurrent ? now.getDate() : daysInMonth;

  const perDay = new Map<number, number>();
  (p.dailyExpenses ?? []).forEach((d) => {
    const day = Number(d.key.split('-')[2]);
    if (day) perDay.set(day, (perDay.get(day) ?? 0) + d.despesas);
  });

  let acc = 0;
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    acc += perDay.get(day) ?? 0;
    return {
      day,
      real: day <= lastDay ? acc : null,
      ideal: p.limit ? (p.limit * day) / daysInMonth : null,
    };
  });
  const maxY = Math.max(p.limit ?? 0, acc, 1) * 1.08;
  const today = data[lastDay - 1];

  return (
    <div className="h-28 px-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, left: 8, right: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, maxY]} />
          <RechartsTooltip
            cursor={{ stroke: 'hsl(var(--border))' }}
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lift">
                  <p className="font-semibold">Dia {payload[0].payload.day}</p>
                  {payload[0].payload.real != null && <p className="text-muted-foreground">Gasto: {formatCurrency(payload[0].payload.real)}</p>}
                  {payload[0].payload.ideal != null && <p className="text-muted-foreground">Ritmo do limite: {formatCurrency(payload[0].payload.ideal)}</p>}
                </div>
              ) : null
            }
          />
          {p.limit && <Line type="linear" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.6} dot={false} strokeWidth={1.5} isAnimationActive={false} />}
          <Area type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2.25} fill="url(#paceFill)" connectNulls={false} dot={false} />
          {today && today.real != null && <ReferenceDot x={today.day} y={today.real} r={4} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Card principal: quanto ainda dá para gastar (discreto), ritmo do mês e a dica do momento. */
function SpendCard({ props, insights }: { props: InsightsHeroProps; insights: Insight[] }) {
  const remaining = props.limit != null ? props.limit - props.expense : props.leftovers - props.openExpenseTotal;
  const negative = remaining < 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
      <div className="px-5 pt-5">
        <p className="text-sm text-muted-foreground">{negative && props.limit == null ? 'Faltam para fechar o mês' : 'Você ainda pode gastar'}</p>
        {props.isLoading ? (
          <Skeleton className="mt-2 h-9 w-44" />
        ) : (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className={cn('font-num text-3xl font-bold leading-none', negative && 'text-danger')}>
              {formatCurrency(Math.abs(remaining))}
            </span>
            {props.limit != null && <span className="text-sm text-muted-foreground">/ {formatCurrency(props.limit)}</span>}
          </p>
        )}
        {props.limit == null && !props.isLoading && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Saldo do mês ({formatCurrency(props.leftovers)}) menos {formatCurrency(props.openExpenseTotal)} em contas em aberto.
          </p>
        )}
      </div>
      <div className="mt-3 flex-1">
        {props.isLoading ? <Skeleton className="mx-5 h-24" /> : <PaceChart p={props} />}
      </div>
      <TipsStrip insights={insights} isLoading={props.isLoading} />
    </div>
  );
}

/** Card do limite de gasto do mês, com edição inline. */
function LimitCard({ limit, expense, onChange, isLoading }: { limit: number | null; expense: number; onChange: (v: number | null) => void; isLoading: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const save = () => {
    const n = Number(value.replace(/\./g, '').replace(',', '.'));
    onChange(Number.isFinite(n) && n > 0 ? n : null);
    setEditing(false);
  };

  const pct = limit ? Math.min(100, (expense / limit) * 100) : 0;
  const over = limit != null && expense > limit;

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
          Limite do mês
        </p>
        {!editing && (
          <button
            onClick={() => { setValue(limit ? String(limit).replace('.', ',') : ''); setEditing(true); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition-theme hover:bg-primary/10"
          >
            <Pencil className="h-3 w-3" /> {limit ? 'Editar' : 'Definir'}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-3 flex gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: 5000 (vazio remove)"
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]">
            Salvar
          </button>
        </form>
      ) : isLoading ? (
        <Skeleton className="mt-3 h-10" />
      ) : limit ? (
        <>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className={cn('font-num text-2xl font-bold', over && 'text-danger')}>{formatCurrency(expense)}</span>
            <span className="text-sm text-muted-foreground">de {formatCurrency(limit)}</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-2 rounded-full transition-all', over ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {over ? `${formatCurrency(expense - limit)} acima do limite` : `Restam ${formatCurrency(limit - expense)} no mês`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Defina quanto quer gastar no mês e acompanhe o ritmo aqui e nas dicas.
        </p>
      )}
    </div>
  );
}

export function InsightsHero(props: InsightsHeroProps) {
  const insights = buildInsights(props);
  const nextDate = props.nextDue
    ? new Date(props.nextDue.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  return (
    <section className="grid animate-rise gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <SpendCard props={props} insights={insights} />

      <div className="grid content-start gap-4">
        <div className="flex items-start gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
            <Receipt className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            {props.isLoading ? (
              <Skeleton className="h-12 w-40" />
            ) : props.openExpenseCount === 0 ? (
              <p className="text-sm font-semibold">Nenhuma conta a pagar neste mês</p>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {props.openExpenseCount} {props.openExpenseCount === 1 ? 'conta a pagar' : 'contas a pagar'}
                </p>
                <p className="font-num mt-1 text-2xl font-bold leading-none">{formatCurrency(props.openExpenseTotal)}</p>
                {nextDate && props.nextDue && (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    Próxima: {props.nextDue.description}, {nextDate}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <LimitCard limit={props.limit} expense={props.expense} onChange={props.onChangeLimit} isLoading={props.isLoading} />
      </div>
    </section>
  );
}
