import { formatCurrency } from '@/utils/currency';

interface FlowItem {
  name: string;
  color: string;
  amount: number;
}

interface MoneyFlowProps {
  income: number;
  expenses: FlowItem[];
  maxItems?: number;
}

/**
 * "Para onde foi": a receita do período à esquerda se abre em fitas até cada
 * categoria de gasto (e o que sobrou). Se gastou mais do que entrou, a barra de
 * receita fica menor que a coluna de gastos — a diferença é visível a olho.
 */
export function MoneyFlow({ income, expenses, maxItems = 6 }: MoneyFlowProps) {
  const sorted = [...expenses].filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, maxItems);
  const rest = sorted.slice(maxItems).reduce((s, e) => s + e.amount, 0);
  const segments: FlowItem[] = [...top];
  if (rest > 0) segments.push({ name: 'Outras', color: 'hsl(var(--muted-foreground))', amount: rest });

  const totalExpense = sorted.reduce((s, e) => s + e.amount, 0);
  const surplus = income - totalExpense;
  if (surplus > 0) segments.push({ name: 'Sobrou', color: 'hsl(var(--success))', amount: surplus });

  const total = Math.max(income, totalExpense);
  if (total <= 0 || segments.length === 0) return null;

  const leftHeight = (income / total) * 100;
  // quando gastou mais que ganhou, as fitas se comprimem para caber na barra de receita
  const leftScale = totalExpense > income ? income / totalExpense : 1;

  let rightCursor = 0;
  let leftCursor = 0;
  const ribbons = segments.map((seg) => {
    const rh = (seg.amount / total) * 100;
    const lh = rh * leftScale;
    const r0 = rightCursor;
    const l0 = leftCursor;
    rightCursor += rh;
    leftCursor += lh;
    const d = `M 5 ${l0} C 50 ${l0}, 50 ${r0}, 95 ${r0} L 95 ${r0 + rh} C 50 ${r0 + rh}, 50 ${l0 + lh}, 5 ${l0 + lh} Z`;
    return { seg, d, rh, r0 };
  });

  return (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-stretch gap-3">
        <div className="flex w-20 flex-col justify-start pt-1 text-right sm:w-24">
          <p className="text-xs font-medium text-muted-foreground">Receitas</p>
          <p className="font-num text-sm font-bold">{formatCurrency(income)}</p>
        </div>
        <div className="relative h-64">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Fluxo da receita para as categorias de gasto">
            {ribbons.map(({ seg, d }) => (
              <path key={seg.name} d={d} fill={seg.color} fillOpacity={0.28} stroke="hsl(var(--card))" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
            ))}
            <rect x="0" y="0" width="5" height={leftHeight} fill="hsl(var(--primary))" rx="0.8" />
            {ribbons.map(({ seg, r0, rh }) => (
              <rect key={seg.name} x="95" y={r0} width="5" height={Math.max(rh, 0.4)} fill={seg.color} />
            ))}
          </svg>
        </div>
      </div>

      <ul className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {segments.map((seg) => (
          <li key={seg.name} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="truncate">{seg.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-muted-foreground">{Math.round((seg.amount / total) * 100)}%</span>
              <span className="font-num font-semibold">{formatCurrency(seg.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
      {totalExpense > income && (
        <p className="mt-3 text-xs text-muted-foreground">
          Os gastos passaram da receita em {formatCurrency(totalExpense - income)} neste período.
        </p>
      )}
    </div>
  );
}
