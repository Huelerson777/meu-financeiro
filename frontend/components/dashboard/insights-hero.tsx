'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, Gauge, PieChart, Pencil, Sparkles,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
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
  /** Receitas previstas no mês que ainda não entraram. */
  openIncomeTotal: number;
  /** Receitas - despesas do mês anterior (pra comparar a sobra). */
  previousResult?: number;
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

  // Alertas (conta atrasada, orçamento estourado) NÃO entram aqui: num
  // carrossel que gira sozinho eles somem da tela. Ficam fixos — atrasadas em
  // "Para fazer agora" e orçamento no próprio hero.

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
      className="flex flex-col gap-2 border-t border-primary/15 bg-primary/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        Dica do PouPay
      </p>
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-5 w-2/3" />
        ) : !tip ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Lance receitas e despesas deste mês para começar a ver leituras sobre o seu dinheiro.
          </p>
        ) : (
          <div key={current} className="flex min-h-[2.5rem] animate-fade-in items-start gap-2 sm:min-h-0 sm:items-center">
            <tip.icon className={cn('mt-0.5 h-4 w-4 shrink-0 sm:mt-0', toneIcon[tip.tone])} strokeWidth={1.9} />
            <p className="text-sm leading-snug">
              <span className="font-semibold">{tip.title}.</span> <span className="text-muted-foreground">{tip.text}</span>
            </p>
          </div>
        )}
      </div>
      {count > 1 && (
        <div className="flex shrink-0 items-center justify-between gap-3">
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

/**
 * Quanto ainda dá pra gastar no mês. Com limite definido: limite − gasto.
 * Sem limite: o que entrou no mês − o que já saiu − o que ainda vence.
 * (Antes usava o saldo acumulado das contas, o que dava uma folga irreal —
 * ex: "pode gastar R$ 33 mil" pra quem recebe R$ 8,5 mil.)
 */
export function computeFreeToSpend(p: Pick<InsightsHeroProps, 'limit' | 'income' | 'expense' | 'openExpenseTotal'>) {
  return p.limit != null ? p.limit - p.expense : p.income - p.expense - p.openExpenseTotal;
}

/** Bloco principal: quanto ainda dá para gastar (discreto) e o ritmo do mês. */
function SpendBlock({ props }: { props: InsightsHeroProps }) {
  const remaining = computeFreeToSpend(props);
  const negative = remaining < 0;

  return (
    <div className="flex min-w-0 flex-col">
      <div className="px-5 pt-5">
        <p className="text-sm text-muted-foreground">
          {negative
            ? props.limit == null ? 'Faltam para fechar o mês' : 'Você passou do limite em'
            : props.limit == null ? 'Livre para gastar este mês' : 'Ainda cabe no seu limite'}
        </p>
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
        {!props.isLoading && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {props.limit != null ? (
              <>Limite de {formatCurrency(props.limit)} menos {formatCurrency(props.expense)} já gastos.</>
            ) : (
              <>
                Entrou {formatCurrency(props.income)}, saiu {formatCurrency(props.expense)} e ainda vence{' '}
                {formatCurrency(props.openExpenseTotal)}.
                {props.openIncomeTotal > 0 && (
                  <> Sem contar {formatCurrency(props.openIncomeTotal)} a receber.</>
                )}
              </>
            )}
          </p>
        )}
      </div>
      <div className="mt-3 flex-1 pb-3">
        {props.isLoading ? <Skeleton className="mx-5 h-24" /> : <PaceChart p={props} />}
      </div>
    </div>
  );
}

/** Sobra do mês (receitas − despesas) comparada com o mês anterior. */
function ResultBlock({ props }: { props: InsightsHeroProps }) {
  const result = props.income - props.expense;
  const prev = props.previousResult;
  const pct = prev != null && prev !== 0 ? Math.round(((result - prev) / Math.abs(prev)) * 100) : null;
  const up = pct != null && pct >= 0;

  return (
    <div className="flex-1 p-5">
      <p className="text-sm text-muted-foreground">Sobra do mês</p>
      {props.isLoading ? (
        <Skeleton className="mt-2 h-8 w-36" />
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn('font-num text-2xl font-semibold leading-none', result < 0 && 'text-danger')}>
              {formatCurrency(result)}
            </span>
            {pct != null && (
              <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {Math.abs(pct)}%
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Receitas menos despesas já pagas.{' '}
            {prev != null ? `No mês passado: ${formatCurrency(prev)}.` : ''}
          </p>
        </>
      )}
    </div>
  );
}

/** Limite de gasto do mês, com edição inline. */
function LimitBlock({ limit, expense, onChange, isLoading }: { limit: number | null; expense: number; onChange: (v: number | null) => void; isLoading: boolean }) {
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
    <div className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
          Limite do mês
        </p>
        {!editing && (
          <button
            onClick={() => { setValue(limit ? String(limit).replace('.', ',') : ''); setEditing(true); }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-theme hover:bg-primary/10"
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
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          <button type="submit" className="h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]">
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

  // Responde "estou bem este mês?": o que dá pra gastar e o ritmo à esquerda,
  // a sobra vs. mês passado e o limite à direita, e uma dica no rodapé.
  // O que precisa de ação (contas atrasadas/vencendo) fica em "Para fazer agora".
  return (
    <section className="animate-rise overflow-hidden rounded-[1.375rem] border border-border/60 bg-card shadow-soft">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SpendBlock props={props} />

        <div className="flex flex-col divide-y divide-border/60 border-t border-border/60 lg:border-l lg:border-t-0">
          <ResultBlock props={props} />
          {props.budgetAlert && !props.isLoading && (
            <Link
              href="/budgets"
              className="flex items-start gap-2.5 bg-danger/[0.06] px-5 py-3 text-sm transition-colors hover:bg-danger/10"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.9} />
              <span>
                <span className="font-semibold">{props.budgetAlert.name} passou do orçamento</span>{' '}
                <span className="text-muted-foreground">
                  em {formatCurrency(props.budgetAlert.over)} ({props.budgetAlert.pct}% do planejado).
                </span>
              </span>
            </Link>
          )}
          <LimitBlock limit={props.limit} expense={props.expense} onChange={props.onChangeLimit} isLoading={props.isLoading} />
        </div>
      </div>
      <TipsStrip insights={insights} isLoading={props.isLoading} />
    </section>
  );
}
