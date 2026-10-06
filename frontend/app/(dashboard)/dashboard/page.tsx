'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, PiggyBank, Target, CircleCheck, CircleDashed, Wallet, X } from 'lucide-react';
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
import { ChartTooltip, SingleValueTooltip } from '@/components/dashboard/chart-tooltips';
import { SummaryCard } from '@/components/dashboard/summary-card';
import { SortableWidget } from '@/components/dashboard/sortable-widget';
import { TransactionDetailModal } from '@/components/dashboard/transaction-detail-modal';
import { useCashFlowReport } from '@/hooks/use-reports';
import { useBudgets } from '@/hooks/use-budgets';
import { useMonthlyLimit } from '@/hooks/use-monthly-limit';
import { PaymentsStatusCard } from '@/components/dashboard/payments-status-card';
import { GoalsSummaryCard } from '@/components/dashboard/goals-summary-card';
import { YearlyChartCard } from '@/components/dashboard/yearly-chart-card';
import { AccountBalancesCard } from '@/components/dashboard/account-balances-card';
import { CategoryDonutCard } from '@/components/dashboard/category-donut-card';
import { ResultCard } from '@/components/dashboard/result-card';
import { RecentTransactionsCard } from '@/components/dashboard/recent-transactions-card';
import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { InsightsHero } from '@/components/dashboard/insights-hero';
import { AiQuickAddCard } from '@/components/dashboard/ai-quick-add-card';
import { WidgetPicker, useDashboardWidgetOrder, WIDGET_SPANS } from '@/components/dashboard/widget-picker';
import { AccountVisibilityPicker, useHiddenAccountIds } from '@/components/dashboard/account-visibility-picker';
import { PaymentModal } from '@/components/cards/payment-modal';
import {
  useDashboardSummary,
  useDashboardExpensesByCategory,
  useDashboardPaymentsStatus,
  useGoalsSummary,
  useNetWorthTrend,
} from '@/hooks/use-dashboard';
import { useAccounts } from '@/hooks/use-accounts';
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


export default function DashboardPage() {
  const router = useRouter();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Sempre calculado a partir do ano atual (não mais uma lista fixa) — assim
  // quando o ano virar (ex: 2026 -> 2027) a opção do novo ano já aparece
  // sozinha no seletor, sem precisar lembrar de atualizar isso a cada virada.
  const thisYear = currentDate.getFullYear();
  const yearOptions = Array.from(new Set([thisYear - 2, thisYear - 1, thisYear, thisYear + 1, selectedYear])).sort();

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
  const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
  const prevParams = { month: prevDate.getMonth() + 1, year: prevDate.getFullYear() };
  const { data: prevData } = useDashboardSummary(prevParams);
  const { data: prevCategoryData } = useDashboardExpensesByCategory(prevParams);
  const { data: goalsSummary, isLoading: goalsLoading } = useGoalsSummary();
  const { data: netWorthData, isLoading: netWorthLoading } = useNetWorthTrend(12);
  const { data: accountsData, isLoading: accountsLoading } = useAccounts();
  const { hiddenIds: hiddenAccountIds, setHiddenIds: setHiddenAccountIds } = useHiddenAccountIds();
  const { limit: monthlyLimit, setLimit: setMonthlyLimit } = useMonthlyLimit();
  const { data: budgetList } = useBudgets(selectedMonth, selectedYear);
  const budgetMap = new Map((budgetList ?? []).map((b) => [b.categoryId, b.amount]));
  const monthStartStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const monthEndStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth, 0).getDate()).padStart(2, '0')}`;
  const { data: monthCashFlow } = useCashFlowReport({ startDate: monthStartStr, endDate: monthEndStr });
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

  // ITEM 5 — dados do gráfico Balanço do Mês com Investimentos e Saldo
  const comparisonData = [
    {
      name: 'Resumo do Mês',
      Receitas: data?.totalIncome ?? 0,
      Despesas: data?.totalExpense ?? 0,
      Investimentos: data?.totalInvested ?? 0,
      Saldo: Math.max(data?.leftovers ?? 0, 0), // não plota barra negativa
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
      // A API já filtra por tipo, status pago e mês/ano selecionados no
      // Dashboard; o filtro de status abaixo é só uma rede de segurança.
      const res = await api.get('/transactions', {
        params: { type, status: 'PAID', startDate, endDate, limit: 100 },
      });
      const raw = res.data;
      const list = Array.isArray(raw?.data?.items) ? raw.data.items
        : Array.isArray(raw?.items) ? raw.items
        : Array.isArray(raw) ? raw
        : [];
      setAllTransactions(list.filter((t: any) => t.status === 'PAID'));
    } catch {
      setAllTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

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
  const sortedAccountBalances = accountsData
    ? accountsData.items
        .filter((acc) => !hiddenAccountIds.includes(acc.id))
        .sort((a, b) => Number(b.currentBalance) - Number(a.currentBalance))
    : [];

  // categoria que mais estourou o orçamento do mês (se houver)
  const budgetAlert = (() => {
    let worst: { name: string; over: number; pct: number } | null = null;
    sortedCategoryData.forEach((c) => {
      const budget = c.categoryId ? budgetMap.get(c.categoryId) : undefined;
      if (budget && c.total > budget && (!worst || c.total - budget > worst.over)) {
        worst = { name: c.name, over: c.total - budget, pct: Math.round((c.total / budget) * 100) };
      }
    });
    return worst;
  })();

  const hideAccountFromChart = (accountId: string) => {
    setHiddenAccountIds([...hiddenAccountIds, accountId]);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho + seletor de mês/ano */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhe suas finanças em tempo real.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="flex h-10 items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
            className="flex h-10 items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <WidgetPicker />
        </div>
      </div>

      <InsightsHero
        isLoading={isLoading || paymentsLoading}
        month={selectedMonth}
        year={selectedYear}
        income={data?.totalIncome ?? 0}
        expense={data?.totalExpense ?? 0}
        leftovers={data?.leftovers ?? 0}
        openExpenseTotal={paymentsStatus?.openExpenseTotal ?? 0}
        openExpenseCount={paymentsStatus?.openItems.filter((i) => i.type === 'EXPENSE').length ?? 0}
        overdueCount={paymentsStatus?.openItems.filter((i) => i.isOverdue && i.type === 'EXPENSE').length ?? 0}
        nextDue={
          paymentsStatus?.openItems
            .filter((i) => i.type === 'EXPENSE' && !i.isOverdue)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
        }
        expenseChangePct={data?.comparison?.expenseChangePct}
        topCategory={sortedCategoryData[0] ?? null}
        dailyExpenses={monthCashFlow?.series}
        budgetAlert={budgetAlert}
        limit={monthlyLimit}
        onChangeLimit={setMonthlyLimit}
      />

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
              label="Saldo"
              value={data?.leftovers}
              icon={Target}
              tone={(data?.leftovers ?? 0) >= 0 ? 'success' : 'danger'}
              isLoading={isLoading}
              changePct={data?.comparison?.leftoversChangePct}
            />
          ),
          paymentsStatus: <PaymentsStatusCard status={paymentsStatus} isLoading={paymentsLoading} onPay={setPayingItem} />,
          netWorth: <NetWorthCard points={netWorthData} isLoading={netWorthLoading} />,
          goalsSummary: <GoalsSummaryCard summary={goalsSummary} isLoading={goalsLoading} />,
          balanceChart: (
            <ResultCard
              income={data?.totalIncome ?? 0}
              expense={data?.totalExpense ?? 0}
              invested={data?.totalInvested ?? 0}
              result={(data?.totalIncome ?? 0) - (data?.totalExpense ?? 0)}
              previousResult={prevData ? prevData.totalIncome - prevData.totalExpense : undefined}
              isLoading={isLoading}
            />
          ),
          yearlyChart: <YearlyChartCard year={selectedYear} data={monthlyFlow} />,
          categoryChart: (
            <CategoryDonutCard
              data={categoryData}
              previous={prevCategoryData}
              budgets={budgetMap}
              isLoading={catLoading}
              onSelect={goToCategoryTransactions}
            />
          ),
          recentTransactions: <RecentTransactionsCard />,
          accountBalances: (
            <AccountBalancesCard
              allAccounts={accountsData?.items ?? []}
              accounts={sortedAccountBalances}
              isLoading={accountsLoading}
              onHide={hideAccountFromChart}
              onOpen={() => router.push('/accounts')}
            />
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