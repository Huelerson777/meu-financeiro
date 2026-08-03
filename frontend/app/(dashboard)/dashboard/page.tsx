'use client';

import { Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { useDashboardSummary } from '@/hooks/use-dashboard';
import { formatCurrency } from '@/utils/currency';

// Placeholder ilustrativo — substituir por dados reais de /dashboard/monthly-flow
const monthlyFlow = [
  { month: 'Fev', receitas: 6200, despesas: 3800 },
  { month: 'Mar', receitas: 6500, despesas: 4100 },
  { month: 'Abr', receitas: 6300, despesas: 3950 },
  { month: 'Mai', receitas: 7000, despesas: 4400 },
  { month: 'Jun', receitas: 6800, despesas: 4200 },
  { month: 'Jul', receitas: 7200, despesas: 4600 },
];

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Acompanhe suas finanças em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Saldo atual" value={data?.currentBalance} icon={Wallet} isLoading={isLoading} />
        <SummaryCard label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading} />
        <SummaryCard label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading} />
        <SummaryCard label="Limite usado nos cartões" value={data?.cardsUsedLimit} icon={CreditCard} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo mensal — Receitas x Despesas</CardTitle>
        </CardHeader>
        <CardContent className="h-72 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyFlow} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--danger))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                }}
              />
              <Area type="monotone" dataKey="receitas" stroke="hsl(var(--success))" fill="url(#colorReceitas)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesas" stroke="hsl(var(--danger))" fill="url(#colorDespesas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
