'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, PiggyBank, Target, CircleCheck, CircleDashed, Wallet } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { TransactionDetailModal } from '@/components/dashboard/transaction-detail-modal';
import { WidgetPicker, useEnabledWidgets } from '@/components/dashboard/widget-picker';
import {
  useDashboardSummary,
  useDashboardExpensesByCategory,
  useDashboardPaymentsStatus,
  useNetWorthTrend,
  useGoalsSummary,
} from '@/hooks/use-dashboard';
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
  const router = useRouter();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // ITEM 4 — passa month/year para que o hook realmente filtre no backend
  const { data, isLoading } = useDashboardSummary({ month: selectedMonth, year: selectedYear });
  const { data: categoryData, isLoading: catLoading } = useDashboardExpensesByCategory({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: paymentsStatus, isLoading: paymentsLoading } = useDashboardPaymentsStatus({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: netWorthTrend, isLoading: netWorthLoading } = useNetWorthTrend(12);
  const { data: goalsSummary, isLoading: goalsLoading } = useGoalsSummary();
  const { isEnabled } = useEnabledWidgets();

  // Clique numa barra do gráfico de categoria leva pra Transações já filtrado
  const goToCategoryTransactions = (categoryId: string | null) => {
    if (!categoryId) return;
    const monthStr = String(selectedMonth).padStart(2, '0');
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
    router.push(`/transactions?categoryId=${categoryId}&startDate=${startDate}&endDate=${endDate}`);
  };

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
  const sortedCategoryData = categoryData ? [...categoryData].sort((a, b) => b.total - a.total) : [];

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

          <WidgetPicker />
        </div>
      </div>

      {/* 4 cards: Receitas, Despesas, Investido, Sobras — cada um pode ser ocultado em "Personalizar" */}
      {(isEnabled('income') || isEnabled('expense') || isEnabled('invested') || isEnabled('leftovers')) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isEnabled('income') && (
            <SummaryCard
              label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading}
              onClick={() => openDetail('INCOME')} changePct={data?.comparison?.incomeChangePct}
            />
          )}
          {isEnabled('expense') && (
            <SummaryCard
              label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading}
              onClick={() => openDetail('EXPENSE')} changePct={data?.comparison?.expenseChangePct} invertChangeTone
            />
          )}
          {isEnabled('invested') && (
            <SummaryCard
              label="Investido" value={data?.totalInvested} icon={PiggyBank} isLoading={isLoading}
              changePct={data?.comparison?.investedChangePct}
            />
          )}
          {isEnabled('leftovers') && (
            <SummaryCard
              label="Sobras"
              value={data?.leftovers}
              icon={Target}
              tone={(data?.leftovers ?? 0) >= 0 ? 'success' : 'danger'}
              isLoading={isLoading}
              changePct={data?.comparison?.leftoversChangePct}
            />
          )}
        </div>
      )}

      {/* Pago x Em Aberto */}
      {isEnabled('paymentsStatus') && (
        <Card>
          <CardHeader>
            <CardTitle>Pago x Em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <CircleCheck className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Pago no mês</p>
                  <p className="text-xl font-semibold">{formatCurrency(paymentsStatus?.paidExpenseTotal ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <CircleDashed className="h-8 w-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Em aberto no mês</p>
                  <p className="text-xl font-semibold">{formatCurrency(paymentsStatus?.openExpenseTotal ?? 0)}</p>
                </div>
              </div>
            </div>

            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : !paymentsStatus || paymentsStatus.openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nada em aberto neste mês — tudo pago!
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {paymentsStatus.openItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.description}
                        {item.isOverdue && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                            Atrasado
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.source} · vence em {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${item.type === 'INCOME' ? 'text-success' : 'text-foreground'}`}>
                      {item.type === 'INCOME' ? '+ ' : ''}{formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linha 2 — Balanço do Mês + Evolução Anual */}
      {(isEnabled('balanceChart') || isEnabled('yearlyChart')) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ITEM 5 — Balanço do Mês com labels no topo das barras */}
        {isEnabled('balanceChart') && (
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
        )}

        {/* ITEM 4 — Evolução Anual com dados reais do backend */}
        {isEnabled('yearlyChart') && (
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
        )}
      </div>
      )}

      {/* ITEM 7 — Gráfico de Despesas por Categoria */}
      {isEnabled('categoryChart') && (
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
                  data={sortedCategoryData}
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
                  <Bar
                    dataKey="total"
                    radius={[0, 4, 4, 0]}
                    barSize={22}
                    cursor="pointer"
                    onClick={(entry: any) => goToCategoryTransactions(entry.categoryId ?? null)}
                  >
                    {sortedCategoryData.map((entry, index) => (
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
      )}

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