import { ReactNode } from 'react';
import { AlertTriangle, CalendarClock, PieChart, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
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
  overdueCount: number;
  nextDue?: { description: string; dueDate: string; amount: number } | null;
  expenseChangePct?: number | null;
  topCategory?: { name: string; total: number } | null;
}

type Tone = 'good' | 'bad' | 'neutral';

interface Insight {
  icon: typeof Sparkles;
  tone: Tone;
  title: string;
  text: ReactNode;
}

const toneStyles: Record<Tone, string> = {
  good: 'bg-success/10 text-success',
  bad: 'bg-danger/10 text-danger',
  neutral: 'bg-warning/10 text-warning',
};

function buildInsights(p: InsightsHeroProps): Insight[] {
  const list: Insight[] = [];
  const now = new Date();
  const isCurrentMonth = now.getMonth() + 1 === p.month && now.getFullYear() === p.year;

  if (p.overdueCount > 0) {
    list.push({
      icon: AlertTriangle,
      tone: 'bad',
      title: `${p.overdueCount} ${p.overdueCount === 1 ? 'conta atrasada' : 'contas atrasadas'}`,
      text: 'Regularize para evitar juros e multa.',
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
    const daysInMonth = new Date(p.year, p.month, 0).getDate();
    const projected = (p.expense / day) * daysInMonth;
    list.push({
      icon: CalendarClock,
      tone: p.income > 0 && projected > p.income ? 'bad' : 'neutral',
      title: `Ritmo: ${formatCurrency(p.expense / day)}/dia`,
      text: `Neste ritmo o mês fecha perto de ${formatCurrency(projected)} em despesas.`,
    });
  }

  if (p.nextDue) {
    const d = new Date(p.nextDue.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    list.push({
      icon: CalendarClock,
      tone: 'neutral',
      title: `Próximo vencimento: ${d}`,
      text: `${p.nextDue.description} · ${formatCurrency(p.nextDue.amount)}`,
    });
  }

  return list.slice(0, 4);
}

export function InsightsHero(props: InsightsHeroProps) {
  const free = props.leftovers - props.openExpenseTotal;
  const insights = buildInsights(props);
  const positive = free >= 0;

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] animate-rise">
      {/* Número-âncora: quanto realmente sobra depois das contas em aberto */}
      <div className={`relative overflow-hidden rounded-xl p-6 text-[hsl(42_45%_97%)] shadow-lift sm:p-8 ${positive ? 'bg-[hsl(163_72%_19%)]' : 'bg-[hsl(8_55%_33%)]'}`}>
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(158_58%_52%/0.22),transparent_65%)]"
        />
        <p className="relative text-sm font-medium text-[hsl(42_45%_97%)]/70">
          {positive ? 'Você ainda pode gastar' : 'Faltam para fechar o mês'}
        </p>
        {props.isLoading ? (
          <Skeleton className="relative mt-3 h-12 w-56 bg-white/15" />
        ) : (
          <p className="font-num relative mt-2 text-5xl font-bold leading-none sm:text-6xl">
            {formatCurrency(Math.abs(free))}
          </p>
        )}
        <p className="relative mt-5 max-w-sm text-sm leading-relaxed text-[hsl(42_45%_97%)]/70">
          Sobras do mês ({formatCurrency(props.leftovers)}) menos {formatCurrency(props.openExpenseTotal)} em contas
          ainda em aberto.
        </p>
      </div>

      <div className={cn('grid gap-3', insights.length > 1 && 'sm:grid-cols-2')}>
        {props.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : insights.length === 0 ? (
          <p className="col-span-full rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Lance receitas e despesas deste mês para começar a ver leituras sobre o seu dinheiro.
          </p>
        ) : (
          insights.map((it) => (
            <div key={it.title} className="flex gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-soft">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', toneStyles[it.tone])}>
                <it.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{it.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{it.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
