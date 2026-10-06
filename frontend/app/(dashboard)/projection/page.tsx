'use client';

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Info } from 'lucide-react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartTooltip } from '@/components/dashboard/chart-tooltips';
import { useProjection, useProjectionSettings } from '@/hooks/use-projection';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';

const HORIZONS = [3, 6, 12] as const;

function compact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}mi`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}mil`;
  return value.toFixed(0);
}

function Row({ label, value, tone, hint }: { label: string; value: number; tone?: 'good' | 'bad'; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ml-2 text-xs">{hint}</span>}
      </span>
      <span className={cn('font-num font-semibold', tone === 'good' && 'text-success', tone === 'bad' && 'text-danger')}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default function ProjectionPage() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(6);
  const { settings, update } = useProjectionSettings();
  const { rows, currentBalance, suggestedIncome, expectedIncome, variableBills, isLoading } = useProjection(horizon, settings);

  const last = rows[rows.length - 1];
  const delta = last ? last.endBalance - currentBalance : 0;
  const loading = isLoading || rows.some((r) => r.loading);
  const noIncome = expectedIncome <= 0;
  const firstNegative = rows.find((r) => r.endBalance < 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Projeção</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Como o saldo deve ficar nos próximos meses, com base no que já está cadastrado.
          </p>
        </div>
        <div role="tablist" className="inline-flex self-start rounded-xl bg-muted p-1">
          {HORIZONS.map((h) => (
            <button
              key={h}
              role="tab"
              aria-selected={horizon === h}
              onClick={() => setHorizon(h)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-theme active:scale-[0.97]',
                horizon === h ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Saldo projetado em {last?.label ?? '—'}</p>
          {loading ? (
            <Skeleton className="mt-3 h-12 w-64" />
          ) : (
            <>
              <p className={cn('font-num mt-2 text-5xl font-bold leading-none', (last?.endBalance ?? 0) < 0 && 'text-danger')}>
                {formatCurrency(last?.endBalance ?? 0)}
              </p>
              <p className={cn('mt-3 inline-flex items-center gap-1 text-sm font-semibold', delta >= 0 ? 'text-success' : 'text-danger')}>
                {delta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {delta >= 0 ? '+' : '-'}
                {formatCurrency(Math.abs(delta))}
                <span className="font-normal text-muted-foreground">em relação ao saldo atual ({formatCurrency(currentBalance)})</span>
              </p>
            </>
          )}

          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows.map((r) => ({ label: r.label, saldo: r.endBalance, resultado: r.net }))} margin={{ top: 8, left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={compact} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Bar dataKey="resultado" name="Resultado do mês" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.net >= 0 ? 'hsl(var(--success))' : 'hsl(var(--danger))'} fillOpacity={0.35} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="saldo" name="Saldo projetado" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {firstNegative && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-danger/10 p-3 text-sm text-danger">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Neste ritmo o saldo fica negativo em {firstNegative.label}. Vale rever gastos ou antecipar receitas.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Premissas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {noIncome && (
              <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
                Receita mensal não configurada. Informe abaixo para a projeção ficar mais precisa.
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Receita mensal esperada
              <input
                inputMode="decimal"
                value={settings.income}
                onChange={(e) => update({ income: e.target.value })}
                placeholder={suggestedIncome > 0 ? `Sugestão: ${formatCurrency(suggestedIncome)}` : 'Ex: 6500'}
                className="h-11 rounded-md border border-input bg-card px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Gastos do dia a dia por mês
              <input
                inputMode="decimal"
                value={settings.flexible}
                onChange={(e) => update({ flexible: e.target.value })}
                placeholder="Mercado, lazer, transporte… Ex: 1800"
                className="h-11 rounded-md border border-input bg-card px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Entram na conta: o saldo das contas marcadas com Controle de Saldo, as contas fixas ativas e as parcelas em
              aberto. {variableBills > 0 && `${variableBills} conta(s) fixa(s) com valor variável não entram no cálculo. `}
              As premissas ficam salvas na sua conta. Receitas recorrentes cadastradas em Recorrentes viram a sugestão de receita.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mês a mês</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            {rows.map((r, idx) => (
              <details key={r.key} open={idx === 0} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold capitalize">
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    {r.label}
                    {r.isCurrent && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">atual</span>}
                  </span>
                  <span className={cn('font-num text-sm font-bold', r.endBalance < 0 && 'text-danger')}>{formatCurrency(r.endBalance)}</span>
                </summary>
                <div className="pb-3 pl-6">
                  <Row label="Saldo inicial" value={r.startBalance} />
                  <Row label="Receitas" value={r.income} tone="good" hint={r.isCurrent ? 'a receber' : undefined} />
                  <Row label="Contas fixas e pendentes" value={-r.recurring} />
                  <Row label="Parcelas" value={-r.installments} />
                  <Row label="Gastos do dia a dia" value={-r.flexible} hint={r.isCurrent ? 'restante do mês' : undefined} />
                  <div className="mt-1 border-t border-border">
                    <Row label="Resultado do mês" value={r.net} tone={r.net >= 0 ? 'good' : 'bad'} />
                  </div>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
