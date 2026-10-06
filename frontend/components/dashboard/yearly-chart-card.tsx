'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartTooltip } from '@/components/dashboard/chart-tooltips';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

interface MonthPoint {
  month: string;
  receitas: number;
  despesas: number;
  investido?: number;
}

const SERIES = [
  { key: 'receitas', label: 'Receitas', color: 'hsl(155 62% 32%)' },
  { key: 'despesas', label: 'Despesas', color: 'hsl(8 62% 50%)' },
  { key: 'investido', label: 'Investido', color: 'hsl(200 55% 45%)' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

function compact(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}mil`;
  return `R$ ${v.toFixed(0)}`;
}

/** Evolução do ano: totais por série (clicáveis para ligar/desligar) e curvas suaves mês a mês. */
export function YearlyChartCard({ year, data }: { year: number; data: MonthPoint[] }) {
  const [hidden, setHidden] = useState<SeriesKey[]>([]);
  const toggle = (k: SeriesKey) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  const totals = (k: SeriesKey) => data.reduce((s, m) => s + Number(m[k] ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Anual {year}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {SERIES.map((s) => {
            const off = hidden.includes(s.key);
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition-theme active:scale-[0.97]',
                  off ? 'border-border bg-transparent opacity-50' : 'border-border/70 bg-card shadow-soft hover:-translate-y-px',
                )}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                <span>
                  <span className="block text-[11px] leading-none text-muted-foreground">{s.label}</span>
                  <span className="font-num mt-1 block text-sm font-bold leading-none">{formatCurrency(totals(s.key))}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 10 }}>
              <defs>
                {SERIES.map((s) => (
                  <linearGradient key={s.key} id={`yearly-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={68} tickFormatter={compact} />
              <RechartsTooltip content={<ChartTooltip />} />
              {SERIES.filter((s) => !hidden.includes(s.key)).map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.25} fill={`url(#yearly-${s.key})`} dot={false} activeDot={{ r: 4 }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
