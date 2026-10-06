'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Gauge, PieChart, Pencil, Receipt, Sparkles,
  TrendingDown, TrendingUp,
} from 'lucide-react';
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
  onChangeLimit: (value: number | null) => void;
}

type Tone = 'good' | 'bad' | 'neutral';

interface Insight {
  icon: typeof Sparkles;
  tone: Tone;
  title: string;
  text: string;
}

const CREAM = 'text-[hsl(42_45%_97%)]';

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
    const rate = Math.round((p.leftovers / p.income) * 100);
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

/** Carrossel de dicas dentro do card principal — troca sozinho, pausa com o mouse em cima. */
function TipsCarousel({ insights }: { insights: Insight[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = insights.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => clearInterval(id);
  }, [count, paused]);

  if (count === 0) {
    return (
      <p className={cn('text-sm leading-relaxed opacity-70', CREAM)}>
        Lance receitas e despesas deste mês para começar a ver leituras sobre o seu dinheiro.
      </p>
    );
  }

  const current = Math.min(index, count - 1);
  const tip = insights[current];
  const go = (delta: number) => setIndex((i) => (Math.min(i, count - 1) + delta + count) % count);

  return (
    <div
      className="rounded-lg bg-black/20 p-4 backdrop-blur-[2px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div key={current} className="flex min-h-[3.75rem] animate-fade-in items-start gap-3">
        <tip.icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', CREAM)} strokeWidth={1.75} />
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold leading-snug', CREAM)}>{tip.title}</p>
          <p className={cn('mt-0.5 text-xs leading-relaxed opacity-70', CREAM)}>{tip.text}</p>
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5" role="tablist" aria-label="Dicas">
            {insights.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === current}
                aria-label={`Dica ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn('h-1.5 rounded-full bg-white transition-all', i === current ? 'w-5 opacity-90' : 'w-1.5 opacity-35 hover:opacity-60')}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={() => go(-1)} aria-label="Dica anterior" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-theme hover:bg-white/20 active:scale-90">
              <ChevronLeft className={cn('h-4 w-4', CREAM)} />
            </button>
            <button onClick={() => go(1)} aria-label="Próxima dica" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-theme hover:bg-white/20 active:scale-90">
              <ChevronRight className={cn('h-4 w-4', CREAM)} />
            </button>
          </div>
        </div>
      )}
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
  const free = props.leftovers - props.openExpenseTotal;
  const insights = buildInsights(props);
  const positive = free >= 0;
  const nextDate = props.nextDue
    ? new Date(props.nextDue.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  return (
    <section className="grid animate-rise gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Número-âncora + dicas */}
      <div className={cn('relative flex flex-col overflow-hidden rounded-xl p-6 shadow-lift sm:p-8', CREAM, positive ? 'bg-[hsl(163_72%_19%)]' : 'bg-[hsl(8_55%_33%)]')}>
        <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(158_58%_52%/0.22),transparent_65%)]" />
        <p className="relative text-sm font-medium opacity-70">{positive ? 'Você ainda pode gastar' : 'Faltam para fechar o mês'}</p>
        {props.isLoading ? (
          <Skeleton className="relative mt-3 h-12 w-56 bg-white/15" />
        ) : (
          <p className="font-num relative mt-2 text-5xl font-bold leading-none sm:text-6xl">{formatCurrency(Math.abs(free))}</p>
        )}
        <p className="relative mt-4 max-w-sm text-sm leading-relaxed opacity-70">
          Saldo do mês ({formatCurrency(props.leftovers)}) menos {formatCurrency(props.openExpenseTotal)} em contas ainda em aberto.
        </p>
        <div className="relative mt-6">
          {props.isLoading ? <Skeleton className="h-24 bg-white/10" /> : <TipsCarousel insights={insights} />}
        </div>
      </div>

      <div className="grid content-start gap-4">
        <div className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
            <Receipt className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            {props.isLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : props.openExpenseCount === 0 ? (
              <p className="text-sm font-semibold">Nenhuma conta a pagar neste mês</p>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {props.openExpenseCount} {props.openExpenseCount === 1 ? 'conta a pagar' : 'contas a pagar'}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Total de {formatCurrency(props.openExpenseTotal)}
                  {nextDate && props.nextDue ? ` · próxima: ${props.nextDue.description}, ${nextDate}` : ''}
                </p>
              </>
            )}
          </div>
        </div>
        <LimitCard limit={props.limit} expense={props.expense} onChange={props.onChangeLimit} isLoading={props.isLoading} />
      </div>
    </section>
  );
}
