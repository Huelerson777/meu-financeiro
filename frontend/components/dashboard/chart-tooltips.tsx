import { formatCurrency } from '@/utils/currency';

/**
 * Tooltip padrão dos gráficos (Recharts) do app. O tooltip nativo vem sem
 * estilo — fundo branco fixo (quebra o tema escuro) e, com mais de uma
 * série, as linhas saem desalinhadas. Usado em qualquer gráfico com mais
 * de uma série (ex: Receitas x Despesas ao longo do tempo).
 */
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="min-w-[170px] rounded-lg border border-border bg-card p-3 text-sm shadow-lift">
      {label && <p className="mb-2 font-semibold text-foreground">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tooltip pra gráficos com um valor por categoria/barra (ex: despesa por
 * categoria, saldo por conta) — mesmo problema do tooltip nativo do
 * ChartTooltip acima, só que pra uma única série.
 */
export function SingleValueTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-lift">
      <p className="font-semibold text-foreground">{entry.payload.name}</p>
      <p className="mt-1 text-muted-foreground">{formatCurrency(entry.value)}</p>
    </div>
  );
}
