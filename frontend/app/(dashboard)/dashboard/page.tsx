'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, PiggyBank, Target, CircleCheck, CircleDashed, Wallet } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, Cell, Tooltip as RechartsTooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, LabelList,
} from 'recharts';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { SortableWidget } from '@/components/dashboard/sortable-widget';
import { TransactionDetailModal } from '@/components/dashboard/transaction-detail-modal';
import { AiQuickAddCard } from '@/components/dashboard/ai-quick-add-card';
import { WidgetPicker, useDashboardWidgetOrder, WIDGET_SPANS } from '@/components/dashboard/widget-picker';
import { PaymentModal } from '@/components/cards/payment-modal';
import {
  useDashboardSummary,
  useDashboardExpensesByCategory,
  useDashboardPaymentsStatus,
  useGoalsSummary,
} from '@/hooks/use-dashboard';
import { PaymentsStatusItem } from '@/services/dashboard.service';
import { formatCurrency } from '@/utils/currency';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';

// Saudação de acordo com o horário local do usuário
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  const { data, isLoading, refetch: refetchSummary } = useDashboardSummary({
    month: selectedMonth,
    year: selectedYear,
  });
  const { data: categoryData, isLoading: catLoading } = useDashboardExpensesByCategory({
    month: selectedMonth,
    year: selectedYear,
  });
  const {
    data: paymentsStatus,
    isLoading: paymentsLoading,
    refetch: refetchPaymentsStatus,
  } = useDashboardPaymentsStatus({ month: selectedMonth, year: selectedYear });
  const { data: goalsSummary, isLoading: goalsLoading } = useGoalsSummary();
  const { order, setOrder } = useDashboardWidgetOrder();
  const firstName = useAuthStore((s) => s.user?.name)?.split(' ')[0];

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  // Enquanto um widget está sendo arrastado, o card original fica só como um
  // "buraco" no lugar (ver SortableWidget) e um clone flutuante do mesmo
  // tamanho (DragOverlay, abaixo) segue o cursor — é isso que evita o grid
  // esticar/pular durante o arraste mesmo com cards de tamanhos bem diferentes,
  // sem abrir mão do reordenar "empurrando" os outros (arrayMove) que é o
  // comportamento intuitivo de arrastar-e-soltar.
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [activeWidgetWidth, setActiveWidgetWidth] = useState<number | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWidgetId(String(event.active.id));
    setActiveWidgetWidth(event.active.rect.current.initial?.width ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveWidgetId(null);
    setActiveWidgetWidth(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setOrder(arrayMove(order, oldIndex, newIndex));
  };

  // Gera (de forma idempotente) o lançamento pendente do mês corrente pra
  // cada conta fixa ativa, assim que o Dashboard é aberto.
  useEffect(() => {
    api.post('/recurring-bills/sync').then(() => {
      refetchPaymentsStatus();
      refetchSummary();
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const monthStr = String(selectedMonth).padStart(2, '0');
      const startDate = `${selectedYear}-${monthStr}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      const res = await api.get('/transactions', {
        params: { type, status: 'PAID', startDate, endDate, limit: 100 },
      });
      const raw = res.data;
      const list = Array.isArray(raw?.data?.items) ? raw.data.items
        : Array.isArray(raw?.items) ? raw.items
        : Array.isArray(raw) ? raw
        : [];
      setAllTransactions(list);
    } catch {
      setAllTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // A API já filtra por tipo e mês/ano selecionados no Dashboard
  const detailTransactions = detailModal ? allTransactions : [];

  // Pagar/receber um item em aberto direto pela lista de "Pago x Em Aberto"
  const [payingItem, setPayingItem] = useState<PaymentsStatusItem | null>(null);

  const handleConfirmPayment = async (accountId: string, date: string, amount: number) => {
    if (!payingItem) return;
    if (payingItem.kind === 'installment') {
      await api.patch(`/cards/installments/${payingItem.id}/pay`, { accountId, date });
    } else {
      // Transação avulsa: só troca o status — a data original é mantida
      // pra não "mudar de mês" o que já foi lançado em fevereiro, por exemplo.
      // O valor pode ser ajustado aqui (útil pra contas fixas que variam mês a mês).
      await api.patch(`/transactions/${payingItem.id}`, { status: 'PAID', accountId, amount });
    }
  };

  const handlePaymentSuccess = () => {
    setPayingItem(null);
    refetchPaymentsStatus();
    refetchSummary();
  };

  const monthlyFlow = data?.monthlyFlow ?? [];
  const sortedCategoryData = categoryData ? [...categoryData].sort((a, b) => b.total - a.total) : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + seletor de mês/ano */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
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

      {/* Cada widget abaixo pode ser ocultado em "Personalizar" e reordenado
          arrastando pelo ícone que aparece no canto ao passar o mouse. */}
      {(() => {
        const widgetContent: Record<string, ReactNode> = {
          aiQuickAdd: (
            <AiQuickAddCard
              onSuccess={() => {
                refetchPaymentsStatus();
                refetchSummary();
              }}
            />
          ),
          income: (
            <SummaryCard
              label="Receitas" value={data?.totalIncome} icon={TrendingUp} tone="success" isLoading={isLoading}
              onClick={() => openDetail('INCOME')} changePct={data?.comparison?.incomeChangePct}
            />
          ),
          expense: (
            <SummaryCard
              label="Despesas" value={data?.totalExpense} icon={TrendingDown} tone="danger" isLoading={isLoading}
              onClick={() => openDetail('EXPENSE')} changePct={data?.comparison?.expenseChangePct} invertChangeTone
            />
          ),
          invested: (
            <SummaryCard
              label="Investido" value={data?.totalInvested} icon={PiggyBank} isLoading={isLoading}
              changePct={data?.comparison?.investedChangePct}
            />
          ),
          leftovers: (
            <SummaryCard
              label="Sobras"
              value={data?.leftovers}
              icon={Target}
              tone={(data?.leftovers ?? 0) >= 0 ? 'success' : 'danger'}
              isLoading={isLoading}
              changePct={data?.comparison?.leftoversChangePct}
            />
          ),
          paymentsStatus: (
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
                      {item.category && (
                        <span
                          className="mt-1 inline-flex w-fit items-center text-xs font-normal px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${item.category.color}20`, color: item.category.color }}
                        >
                          {item.category.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold ${item.type === 'INCOME' ? 'text-success' : 'text-foreground'}`}>
                        {item.type === 'INCOME' ? '+ ' : ''}{formatCurrency(item.amount)}
                      </span>
                      <button
                        onClick={() => setPayingItem(item)}
                        className="text-xs font-semibold text-primary hover:underline shrink-0"
                      >
                        {item.type === 'INCOME' ? 'Receber' : 'Pagar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          ),
          goalsSummary: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Metas
              </span>
              {goalsSummary && goalsSummary.count > 0 && (
                <button
                  onClick={() => router.push('/goals')}
                  className="text-xs font-normal text-primary hover:underline"
                >
                  Ver todas
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
            ) : !goalsSummary || goalsSummary.count === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">Você ainda não tem metas cadastradas.</p>
                <button
                  onClick={() => router.push('/goals')}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Criar sua primeira meta
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Progresso geral</span>
                    <span className="text-sm font-semibold">{goalsSummary.overallProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, goalsSummary.overallProgress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(goalsSummary.totalCurrent)} de {formatCurrency(goalsSummary.totalTarget)}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {goalsSummary.goals.map((g) => (
                    <div key={g.id}>
                      <div className="flex items-baseline justify-between mb-1 gap-2">
                        <span className="text-sm font-medium truncate">{g.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{g.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-success"
                          style={{ width: `${Math.min(100, g.progress)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(g.currentAmount)} de {formatCurrency(g.targetAmount)}
                        {g.deadline ? ` · até ${new Date(g.deadline).toLocaleDateString('pt-BR')}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
          ),
          balanceChart: (
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
          ),
          yearlyChart: (
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
          ),
          categoryChart: (
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
          ),
        };

        const visibleOrder = order.filter((key) => widgetContent[key]);

        return (
          <DndContext
            sensors={dragSensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {visibleOrder.map((key) => (
                  <SortableWidget key={key} id={key} span={WIDGET_SPANS[key]}>
                    {widgetContent[key]}
                  </SortableWidget>
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeWidgetId && (
                <div style={activeWidgetWidth ? { width: activeWidgetWidth } : undefined}>
                  {widgetContent[activeWidgetId]}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        );
      })()}

      <TransactionDetailModal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title={detailModal?.type === 'INCOME' ? 'Receitas' : 'Despesas'}
        monthLabel={`${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][selectedMonth - 1]} de ${selectedYear}`}
        transactions={detailTransactions}
        loading={transactionsLoading}
        tone={detailModal?.type === 'INCOME' ? 'success' : 'danger'}
      />

      {payingItem && (
        <PaymentModal
          title={payingItem.type === 'INCOME' ? 'Confirmar recebimento' : 'Pagar conta'}
          description={payingItem.description}
          amount={payingItem.amount}
          category={payingItem.category}
          amountEditable={payingItem.kind === 'transaction'}
          onClose={() => setPayingItem(null)}
          onSuccess={handlePaymentSuccess}
          onConfirm={handleConfirmPayment}
        />
      )}
    </div>
  );
}