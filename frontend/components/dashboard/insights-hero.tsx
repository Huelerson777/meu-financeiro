'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, Gauge, PieChart, Pencil, Sparkles,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Money, MonthDial, MonthRiver, type RiverOpenItem } from '@/components/dashboard/month-story';
import { formatCurrency, formatCurrencyRound } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface InsightsHeroProps {
  isLoading: boolean;
  month: number;
  year: number;
  income: number;
  expense: number;
  leftovers: number;
  /** Aportes do mês em contas de investimento. */
  invested?: number;
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
  /** Série diária do fluxo de caixa do mês (pago/recebido). */
  dailyFlow?: { key: string; receitas: number; despesas: number }[];
  /** O que ainda está em aberto no mês (trecho pontilhado da linha do mês). */
  openItems?: RiverOpenItem[];
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
      className="flex flex-col gap-2 rounded-2xl bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
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

/**
 * Quanto ainda dá pra gastar no mês. Com limite definido: limite − gasto.
 * Sem limite: o que entrou no mês − o que já saiu − o que ainda vence.
 * (Antes usava o saldo acumulado das contas, o que dava uma folga irreal —
 * ex: "pode gastar R$ 33 mil" pra quem recebe R$ 8,5 mil.)
 */
export function computeFreeToSpend(p: Pick<InsightsHeroProps, 'limit' | 'income' | 'expense' | 'openExpenseTotal'>) {
  return p.limit != null ? p.limit - p.expense : p.income - p.expense - p.openExpenseTotal;
}

/**
 * O mês contado numa frase, com os números dentro do texto (animados) — no
 * lugar de três cartões com um número cada.
 */
function MonthSentence({ props }: { props: InsightsHeroProps }) {
  const now = new Date();
  const isCurrent = now.getMonth() + 1 === props.month && now.getFullYear() === props.year;
  const isFuture = new Date(props.year, props.month - 1, 1) > now;
  const lastDay = new Date(props.year, props.month, 0).getDate();
  const free = computeFreeToSpend(props);
  const result = props.income - props.expense;
  const dim = 'text-muted-foreground';

  if (props.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-11/12" />
        <Skeleton className="h-9 w-8/12" />
      </div>
    );
  }

  if (props.income === 0 && props.expense === 0 && props.openExpenseTotal === 0) {
    return (
      <p className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[2.1rem]">
        {isFuture ? 'Nada previsto para este mês ainda.' : 'Nada lançado neste mês ainda.'}{' '}
        <span className={dim}>Use o “+” para começar.</span>
      </p>
    );
  }

  return (
    <p className="font-display text-[1.6rem] font-semibold leading-[1.2] tracking-tight sm:text-[2.1rem] lg:text-[2.35rem]">
      Entraram <Money value={props.income} className="text-primary" />
      <span className={dim}>, saíram</span> <Money value={props.expense} />
      {props.openExpenseTotal > 0 && (
        <>
          {' '}
          <span className={dim}>
            {isCurrent || isFuture
              ? `e ainda ${props.openExpenseCount === 1 ? 'vence' : 'vencem'}`
              : `e ${props.openExpenseCount === 1 ? 'ficou' : 'ficaram'} em aberto`}
          </span>{' '}
          <Link href="#para-fazer-agora" className="text-warning underline decoration-warning/50 decoration-dashed decoration-2 underline-offset-[6px] transition-colors hover:decoration-warning">
            <Money value={props.openExpenseTotal} />
          </Link>
        </>
      )}
      <span className={dim}>.</span>{' '}
      {props.limit != null ? (
        free >= 0 ? (
          <>
            <span className={dim}>Ainda cabem</span> <Money value={free} className="text-primary" />{' '}
            <span className={dim}>no seu limite de {formatCurrencyRound(props.limit)}.</span>
          </>
        ) : (
          <>
            <span className={dim}>Você passou do limite em</span> <Money value={-free} className="text-danger" />
            <span className={dim}>.</span>
          </>
        )
      ) : isCurrent ? (
        free >= 0 ? (
          <>
            Sobram <Money value={free} className="text-primary" /> <span className={dim}>livres até o dia {lastDay}.</span>
          </>
        ) : (
          <>
            Faltam <Money value={-free} className="text-danger" /> <span className={dim}>para fechar o mês.</span>
          </>
        )
      ) : (
        <>
          {result >= 0 ? 'Sobraram' : 'Faltaram'} <Money value={Math.abs(result)} className={result >= 0 ? 'text-primary' : 'text-danger'} />{' '}
          <span className={dim}>no mês.</span>
        </>
      )}
    </p>
  );
}

/** Linha de apoio sob a frase: sobra vs. mês passado, a receber e o limite (edição inline). */
function SupportLine({ props }: { props: InsightsHeroProps }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const result = props.income - props.expense;
  const prev = props.previousResult;
  const pct = prev != null && prev !== 0 ? Math.round(((result - prev) / Math.abs(prev)) * 100) : null;
  const up = pct != null && pct >= 0;

  const save = () => {
    const n = Number(value.replace(/\./g, '').replace(',', '.'));
    props.onChangeLimit(Number.isFinite(n) && n > 0 ? n : null);
    setEditing(false);
  };

  if (props.isLoading) return <Skeleton className="h-5 w-72 max-w-full" />;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <span className="flex items-center gap-1.5">
        Sobra do mês <span className={cn('font-num font-semibold text-foreground', result < 0 && 'text-danger')}>{formatCurrency(result)}</span>
        {pct != null && (
          <span
            title={`No mês passado: ${formatCurrency(prev!)}`}
            className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold', up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(pct)}%
          </span>
        )}
      </span>
      {props.openIncomeTotal > 0 && (
        <span>
          <span className="font-num font-semibold text-foreground">{formatCurrency(props.openIncomeTotal)}</span> a receber
        </span>
      )}
      <span title="Saldo das contas do dia a dia (sem investimentos) no fim do mês">
        <span className={cn('font-num font-semibold text-foreground', props.leftovers < 0 && 'text-danger')}>{formatCurrency(props.leftovers)}</span> nas contas
      </span>
      {(props.invested ?? 0) > 0 && (
        <span>
          <span className="font-num font-semibold text-foreground">{formatCurrency(props.invested)}</span> investidos no mês
        </span>
      )}
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="decimal"
            aria-label="Limite de gasto do mês"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: 5000 (vazio remove)"
            className="h-9 w-48 rounded-full border border-input bg-card px-3.5 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
          <button type="submit" className="h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]">
            Salvar
          </button>
        </form>
      ) : (
        <button
          onClick={() => { setValue(props.limit ? String(props.limit).replace('.', ',') : ''); setEditing(true); }}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-theme hover:bg-primary/10"
        >
          <Gauge className="h-3.5 w-3.5" strokeWidth={1.9} />
          {props.limit ? `Limite ${formatCurrencyRound(props.limit)}` : 'Definir limite do mês'}
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function InsightsHero(props: InsightsHeroProps) {
  const insights = buildInsights(props);
  const now = new Date();
  const isCurrent = now.getMonth() + 1 === props.month && now.getFullYear() === props.year;
  const isFuture = new Date(props.year, props.month - 1, 1) > now;
  const daysInMonth = new Date(props.year, props.month, 0).getDate();
  const elapsed = isFuture ? 0 : isCurrent ? now.getDate() / daysInMonth : 1;
  const free = computeFreeToSpend(props);

  // Mostrador: de tudo que entrou (ou do limite), quanto já saiu, quanto ainda vence e quanto está livre
  const segments =
    props.limit != null
      ? [
          { key: 'spent', label: 'Já gasto', value: Math.min(props.expense, props.limit), color: 'hsl(var(--foreground) / 0.55)' },
          { key: 'free', label: 'Cabe no limite', value: Math.max(0, free), color: 'hsl(var(--primary))' },
          { key: 'over', label: 'Acima do limite', value: Math.max(0, -free), color: 'hsl(var(--danger))' },
        ]
      : [
          { key: 'spent', label: 'Já saiu', value: props.expense, color: 'hsl(var(--foreground) / 0.55)' },
          { key: 'due', label: 'Ainda vence', value: props.openExpenseTotal, color: 'hsl(var(--warning))' },
          { key: 'free', label: 'Livre', value: Math.max(0, free), color: 'hsl(var(--primary))' },
        ];
  // Mês que já fechou: o centro mostra o que sobrou de fato, não "livre para gastar"
  const closed = !isCurrent && !isFuture && props.limit == null;
  const dialValue = closed ? props.income - props.expense : free;
  const dialCaption = closed
    ? dialValue < 0 ? 'faltou no mês' : 'sobrou no mês'
    : free < 0
      ? props.limit != null ? 'acima do limite' : 'faltam'
      : props.limit != null ? 'cabe no limite' : 'livre para gastar';
  const base = props.limit ?? props.income;
  const spentPct = base > 0 ? Math.round((props.expense / base) * 100) : null;

  // Responde "estou bem este mês?" sem cartões: a frase conta o mês, o
  // mostrador resume, e a linha do mês mostra o caminho (cheio = aconteceu,
  // pontilhado = ainda vem). O que pede ação fica em "Para fazer agora".
  return (
    <section className="flex animate-rise flex-col gap-6">
      <div className="grid items-center gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <MonthSentence props={props} />
          <SupportLine props={props} />
          {props.budgetAlert && !props.isLoading && (
            <Link
              href="/budgets"
              className="flex w-fit max-w-full items-start gap-2 rounded-2xl bg-danger/[0.07] px-3.5 py-2 text-sm transition-colors hover:bg-danger/[0.12]"
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
        </div>

        {props.isLoading ? (
          <Skeleton className="mx-auto h-60 w-60 rounded-full" />
        ) : (
          <MonthDial
            segments={segments}
            elapsed={elapsed}
            caption={dialCaption}
            value={dialValue}
            negative={dialValue < 0}
            footnote={spentPct != null ? `gastou ${spentPct}% · mês em ${Math.round(elapsed * 100)}%` : undefined}
          />
        )}
      </div>

      {props.isLoading ? (
        <Skeleton className="h-44 rounded-2xl sm:h-56" />
      ) : (
        <MonthRiver month={props.month} year={props.year} series={props.dailyFlow} openItems={props.openItems} />
      )}

      <TipsStrip insights={insights} isLoading={props.isLoading} />
    </section>
  );
}
