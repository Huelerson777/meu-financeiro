'use client';

import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { useDashboardSummary, useDashboardExpensesByCategory } from '@/hooks/use-dashboard';
import { formatCurrency } from '@/utils/currency';

// Formata valores grandes de forma compacta (R$ 5 mil, R$ 1,2 mi) para caber no eixo Y
function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
  return `R$ ${value.toFixed(0)}`;
}

// Tooltip customizado para o gráfico de categorias
const CategoryTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-gray-800 dark:text-gray-100">{d.name}</p>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{formatCurrency(d.total)}</p>
      </div>
    );
  }
  return null;
};

// Label customizado para o PieChart — exibe % no centro de cada fatia
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: any) => {
  if (percent < 0.04) return null; // não renderiza label em fatias muito pequenas
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function DashboardPage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // ITEM 4 — passa month/year para que o hook realmente filtre no backend
  const { data, isLoading } = useDashboardSummary({ month: selectedMonth, year: selectedYear });
  const { data: categoryData, isLoading: catLoading } = useDashboardExpensesByCategory({
    month: selectedMonth,
    year: selectedYear,
  });

  // ITEM 5 — dados do gráfico Balanço do Mês com Investimentos e Sobras
  const comparisonData = [
    {
      name: 'Resumo do Mês',
      Receitas: data?.totalIncome ?? 0,
      Despesas: data?.totalExpense ?? 0,
      Investimentos: data?.totalInvested ?? 0,
      Sobras: Math.max(data?.leftovers ?? 0, 0), // não plota barra negativa
    },
  ];

  // ITEM 4 — dados reais da evolução anual vindos do backend
  const monthlyFlow = data?.monthlyFlow ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + seletor de mês/ano */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas finanças em tempo real.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
              'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
              .map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ITEM 3 — sem card de Fatura. 5 cards: Saldo, Receitas, Despesas, Investido, Sobras */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Saldo Geral" value={data?.currentBalance} icon={Wallet} isLoading={isLoading} />
        <SummaryCard label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading} />
        <SummaryCard label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading} />
        <SummaryCard label="Investido" value={data?.totalInvested} icon={PiggyBank} isLoading={isLoading} />
        <SummaryCard
          label="Sobras"
          value={data?.leftovers}
          icon={Target}
          tone={(data?.leftovers ?? 0) >= 0 ? 'success' : 'danger'}
          isLoading={isLoading}
        />
      </div>

      {/* Linha 2 — Balanço do Mês + Evolução Anual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ITEM 5 — Balanço do Mês com labels no topo das barras */}
        <Card>
          <CardHeader>
            <CardTitle>Balanço do Mês</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="Receitas" fill="hsl(var(--success, #16a34a))" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Receitas"
                    position="top"
                    formatter={(val: number) => formatCurrency(val)}
                    style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                </Bar>
                <Bar dataKey="Despesas" fill="hsl(var(--danger, #dc2626))" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Despesas"
                    position="top"
                    formatter={(val: number) => formatCurrency(val)}
                    style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                </Bar>
                <Bar dataKey="Investimentos" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Investimentos"
                    position="top"
                    formatter={(val: number) => formatCurrency(val)}
                    style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                </Bar>
                <Bar dataKey="Sobras" fill="#a855f7" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="Sobras"
                    position="top"
                    formatter={(val: number) => formatCurrency(val)}
                    style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ITEM 4 — Evolução Anual com dados reais do backend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Anual {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent className="h-72 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyFlow} margin={{ left: 8, right: 8, top: 20 }}>
                <defs>
                  <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#16a34a" fill="url(#colorReceitas)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="#dc2626" fill="url(#colorDespesas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ITEM 7 — Gráfico de Despesas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {catLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : !categoryData || categoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma despesa com categoria registrada neste mês.
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Pizza */}
              <div className="w-full lg:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      labelLine={false}
                      label={renderCustomizedLabel}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda detalhada com valores */}
              <div className="w-full lg:w-1/2 flex flex-col gap-2">
                {categoryData.map((cat, i) => {
                  const totalGeral = categoryData.reduce((s, c) => s + c.total, 0);
                  const pct = totalGeral > 0 ? ((cat.total / totalGeral) * 100).toFixed(1) : '0';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="flex-shrink-0 w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                        {cat.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">
                        {pct}%
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 w-24 text-right">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
