'use client';

import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend, LabelList
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { useDashboardSummary } from '@/hooks/use-dashboard'; 
import { formatCurrency } from '@/utils/currency';

export default function DashboardPage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Passando os parâmetros para o hook (você precisará garantir que o hook envia isso na URL da API)
  const { data, isLoading } = useDashboardSummary({ month: selectedMonth, year: selectedYear });

  const comparisonData = [
    {
      name: 'Resumo do Mês',
      Receitas: data?.totalIncome || 0,
      Despesas: data?.totalExpense || 0,
      Investimentos: data?.totalInvested || 0,
      Sobras: data?.leftovers || 0,
    }
  ];

  // Agora pega os dados REAIS da evolução que enviamos pelo backend
  const monthlyFlow = data?.monthlyFlow || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas finanças em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value={1}>Janeiro</option>
            <option value={2}>Fevereiro</option>
            <option value={3}>Março</option>
            <option value={4}>Abril</option>
            <option value={5}>Maio</option>
            <option value={6}>Junho</option>
            <option value={7}>Julho</option>
            <option value={8}>Agosto</option>
            <option value={9}>Setembro</option>
            <option value={10}>Outubro</option>
            <option value={11}>Novembro</option>
            <option value={12}>Dezembro</option>
          </select>

          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>
      </div>

      {/* Removido Fatura do Cartão. Grid atualizado para 5 colunas lg:grid-cols-5 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Saldo Geral" value={data?.currentBalance} icon={Wallet} isLoading={isLoading} />
        <SummaryCard label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading} />
        <SummaryCard label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading} />
        <SummaryCard label="Investido" value={data?.totalInvested} icon={PiggyBank} isLoading={isLoading} />
        <SummaryCard label="Sobras" value={data?.leftovers} icon={Target} tone={data?.leftovers >= 0 ? "success" : "danger"} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Balanço do Mês</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide /> {/* Ocultamos o eixo Y para ficar mais limpo já que temos as labels */}
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="Receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Receitas" position="top" formatter={(val: number) => formatCurrency(val)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                </Bar>
                <Bar dataKey="Despesas" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Despesas" position="top" formatter={(val: number) => formatCurrency(val)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                </Bar>
                <Bar dataKey="Investimentos" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Investimentos" position="top" formatter={(val: number) => formatCurrency(val)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                </Bar>
                <Bar dataKey="Sobras" fill="#a855f7" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="Sobras" position="top" formatter={(val: number) => formatCurrency(val)} style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução Anual</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyFlow} margin={{ left: -20, top: 20 }}>
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
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="receitas" stroke="hsl(var(--success))" fill="url(#colorReceitas)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesas" stroke="hsl(var(--danger))" fill="url(#colorDespesas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}