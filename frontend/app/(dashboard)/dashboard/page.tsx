'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Target } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { TransactionDetailModal } from '@/components/dashboard/transaction-detail-modal';
import { useDashboardSummary, useDashboardExpensesByCategory } from '@/hooks/use-dashboard';
import { formatCurrency } from '@/utils/currency';
import { api } from '@/services/api';

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

  // ITEM 1 — modal de detalhamento ao clicar em Receitas/Despesas
  const [detailModal, setDetailModal] = useState<{ type: 'INCOME' | 'EXPENSE' } | null>(null);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const openDetail = async (type: 'INCOME' | 'EXPENSE') => {
    setDetailModal({ type });
    setTransactionsLoading(true);
    try {
      const res = await api.get('/transactions');
      const raw = res.data;
      const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data
        : [];
      setAllTransactions(list);
    } catch {
      setAllTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Filtra só as transações do tipo e do mês/ano selecionados no Dashboard
  const detailTransactions = detailModal
    ? allTransactions.filter((t) => {
        if (t.type !== detailModal.type) return false;
        const d = new Date(t.date);
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
      })
    : [];

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

      {/* Sem card de Fatura e sem Saldo Geral. 4 cards: Receitas, Despesas, Investido, Sobras */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading} onClick={() => openDetail('INCOME')} />
        <SummaryCard label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading} onClick={() => openDetail('EXPENSE')} />
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
                  <linearGradient id="colorInvestido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                <Area type="monotone" dataKey="investido" name="Investido" stroke="#3b82f6" fill="url(#colorInvestido)" strokeWidth={2} />
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
            // Gráfico de barras horizontais, ordenado do maior pro menor gasto,
            // com o valor exato escrito no final de cada barra (estilo planilha)
            <div style={{ height: Math.max(64 * categoryData.length, 240) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={[...categoryData].sort((a, b) => b.total - a.total)}
                  margin={{ left: 20, right: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip content={<CategoryTooltip />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={22}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cat-cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="total"
                      position="right"
                      formatter={(val: number) => formatCurrency(val)}
                      style={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailModal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={detailModal?.type === 'INCOME' ? 'Receitas' : 'Despesas'}
        monthLabel={`${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMonth - 1]} de ${selectedYear}`}
        transactions={detailTransactions}
        loading={transactionsLoading}
        tone={detailModal?.type === 'INCOME' ? 'success' : 'danger'}
      />
    </div>
  );
}