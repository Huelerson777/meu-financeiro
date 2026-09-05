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
    <div className="min-w-[170px] rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {label && <p className="mb-2 font-semibold text-gray-800 dark:text-gray-100">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-gray-800 dark:text-gray-100">
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
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      <p className="font-semibold text-gray-800 dark:text-gray-100">{entry.payload.name}</p>
      <p className="mt-1 text-gray-600 dark:text-gray-300">{formatCurrency(entry.value)}</p>
    </div>
  );
}
