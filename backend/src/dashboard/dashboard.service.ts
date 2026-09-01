import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string, month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);
    const dateFilter = { gte: startDate, lt: endDate };

    // Busca as contas do tipo INVESTMENT para calcular aportes a partir de transações TRANSFER
    const investmentAccounts = await this.prisma.account.findMany({
      where: { userId, type: 'INVESTMENT', isArchived: false },
      select: { id: true },
    });
    const investmentAccountIds = investmentAccounts.map((a) => a.id);

    const prevMonthDate = new Date(targetYear, targetMonth - 2, 1);
    const prevStartDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const prevEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 1);

    const [
      balanceAgg,
      { totalIncome: currentIncome, totalExpense: currentExpense },
      previousTotals,
      previousInvestedAgg,
      cumulativeTotals,
      previousCumulativeTotals,
    ] = await Promise.all([
        // ITEM 1/6 - Saldo geral filtra por includeInDashboard
        this.prisma.account.aggregate({
          where: { userId, isArchived: false, includeInDashboard: true },
          _sum: { currentBalance: true },
        }),
        this.getIncomeExpenseTotals(userId, dateFilter, investmentAccountIds),
        // Totais do mês anterior, só pra comparação de variação (▲/▼) nos cards
        this.getIncomeExpenseTotals(userId, { gte: prevStartDate, lt: prevEndDate }, investmentAccountIds),
        // Investido no mês anterior, mesma lógica de comparação
        investmentAccountIds.length > 0
          ? this.prisma.transfer.aggregate({
              where: { toId: { in: investmentAccountIds }, date: { gte: prevStartDate, lt: prevEndDate } },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        // Sobras acumuladas: soma de todo o histórico até o fim do mês selecionado —
        // dinheiro que entrou e nunca virou despesa nem investimento continua
        // "sobrando" nos meses seguintes, não zera a cada virada de mês.
        this.getIncomeExpenseTotals(userId, { lt: endDate }, investmentAccountIds),
        // Mesmo cálculo até o fim do mês anterior, pra comparação de variação
        this.getIncomeExpenseTotals(userId, { lt: startDate }, investmentAccountIds),
      ]);

    // ITEM 2 — cálculo correto de investimentos via tabela Transfer (transação atômica)
    let totalInvested = 0;
    let cumulativeInvested = 0;
    let previousCumulativeInvested = 0;
    if (investmentAccountIds.length > 0) {
      const [transfersToInvestment, cumulativeInvestedAgg, previousCumulativeInvestedAgg] = await Promise.all([
        this.prisma.transfer.aggregate({
          where: { toId: { in: investmentAccountIds }, date: dateFilter },
          _sum: { amount: true },
        }),
        // Investido acumulado até o fim do mês selecionado (mesma lógica das sobras)
        this.prisma.transfer.aggregate({
          where: { toId: { in: investmentAccountIds }, date: { lt: endDate } },
          _sum: { amount: true },
        }),
        this.prisma.transfer.aggregate({
          where: { toId: { in: investmentAccountIds }, date: { lt: startDate } },
          _sum: { amount: true },
        }),
      ]);
      totalInvested = Number(transfersToInvestment._sum.amount ?? 0);
      cumulativeInvested = Number(cumulativeInvestedAgg._sum.amount ?? 0);
      previousCumulativeInvested = Number(previousCumulativeInvestedAgg._sum.amount ?? 0);
    }

    const currentBalance = Number(balanceAgg._sum.currentBalance ?? 0);
    const totalIncome = currentIncome;
    const totalExpense = currentExpense;
    // Sobras = saldo acumulado de toda renda (desde o início do histórico até
    // o fim do mês selecionado) que ainda não virou despesa nem investimento —
    // carrega de um mês pro outro em vez de zerar, já que esse dinheiro
    // continua nas contas. Continua contando mesmo que o usuário tenha movido
    // pra outra conta (ex: transferência manual pra uma "reserva"), já que ele
    // não foi gasto nem investido.
    const leftovers = cumulativeTotals.totalIncome - cumulativeTotals.totalExpense - cumulativeInvested;

    // Variação percentual vs. mês anterior — usada nos cards do dashboard
    const pctChange = (current: number, previous: number): number | null => {
      if (previous === 0) return current === 0 ? 0 : null; // sem base de comparação
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };
    const previousInvested = Number(previousInvestedAgg._sum.amount ?? 0);
    const previousLeftovers =
      previousCumulativeTotals.totalIncome - previousCumulativeTotals.totalExpense - previousCumulativeInvested;
    const comparison = {
      incomeChangePct: pctChange(totalIncome, previousTotals.totalIncome),
      expenseChangePct: pctChange(totalExpense, previousTotals.totalExpense),
      leftoversChangePct: pctChange(leftovers, previousLeftovers),
      investedChangePct: pctChange(totalInvested, previousInvested),
    };

    // ITEM 4 — Evolução anual com dados reais, buscando o ano inteiro
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    const yearTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        cardId: null,
        date: { gte: yearStart, lt: yearEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
        OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
      },
      select: { amount: true, type: true, date: true },
    });

    // Parcelas de cartão pagas no ano — contam pelo mês em que foram
    // efetivamente pagas (paidAt), não pelo mês de vencimento na fatura.
    const yearCardInstallments = await this.prisma.installment.findMany({
      where: { paid: true, paidAt: { gte: yearStart, lt: yearEnd }, transaction: { userId, cardId: { not: null } } },
      select: { amount: true, paidAt: true },
    });

    const monthlyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('pt-BR', { month: 'short' }),
      receitas: 0,
      despesas: 0,
      investido: 0,
    }));

    yearTransactions.forEach((t) => {
      const mIndex = t.date.getMonth();
      const val = Number(t.amount);
      if (t.type === 'INCOME') monthlyFlow[mIndex].receitas += val;
      if (t.type === 'EXPENSE') monthlyFlow[mIndex].despesas += val;
    });

    yearCardInstallments.forEach((i) => {
      monthlyFlow[i.paidAt!.getMonth()].despesas += Number(i.amount);
    });

    // Linha de Investido — aportes (Transfer) recebidos por contas INVESTMENT no ano
    if (investmentAccountIds.length > 0) {
      const yearTransfers = await this.prisma.transfer.findMany({
        where: { toId: { in: investmentAccountIds }, date: { gte: yearStart, lt: yearEnd } },
        select: { amount: true, date: true },
      });
      yearTransfers.forEach((t) => {
        monthlyFlow[t.date.getMonth()].investido += Number(t.amount);
      });
    }

    return {
      currentBalance,
      totalIncome,
      totalExpense,
      totalInvested,
      leftovers,
      monthlyFlow,
      comparison,
    };
  }

  /**
   * Soma receitas/despesas pagas num período, com o mesmo critério de
   * inclusão usado no card "Despesas do mês" (respeita includeInDashboard e
   * exclui aportes em contas de investimento — de forma NULL-safe, já que
   * compras de cartão não têm accountId).
   *
   * Compras de cartão (cardId != null) não entram pela data da transação —
   * essa data é o vencimento da parcela na fatura, não quando o dinheiro
   * realmente saiu da conta. Elas contam pra este período pela data em que a
   * parcela foi efetivamente paga (installment.paidAt), já que é possível
   * pagar uma parcela antes da fatura fechar.
   */
  private async getIncomeExpenseTotals(
    userId: string,
    dateFilter: { gte?: Date; lt: Date },
    investmentAccountIds: string[],
  ) {
    const [incomeAgg, nonCardExpenseAgg, cardExpenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'PAID', date: dateFilter, account: { includeInDashboard: true } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          status: 'PAID',
          cardId: null,
          date: dateFilter,
          AND: [
            { OR: [{ account: { includeInDashboard: true } }, { accountId: null }] },
            investmentAccountIds.length > 0
              ? { OR: [{ accountId: null }, { accountId: { notIn: investmentAccountIds } }] }
              : {},
          ],
        },
        _sum: { amount: true },
      }),
      this.prisma.installment.aggregate({
        where: { paid: true, paidAt: dateFilter, transaction: { userId, cardId: { not: null } } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalIncome: Number(incomeAgg._sum.amount ?? 0),
      totalExpense: Number(nonCardExpenseAgg._sum.amount ?? 0) + Number(cardExpenseAgg._sum.amount ?? 0),
    };
  }

  // ITEM 4 — endpoint separado para evolução anual (mantido compatível)
  async getMonthlyFlow(userId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    const investmentAccounts = await this.prisma.account.findMany({
      where: { userId, type: 'INVESTMENT', isArchived: false },
      select: { id: true },
    });
    const investmentAccountIds = investmentAccounts.map((a) => a.id);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        cardId: null,
        date: { gte: yearStart, lt: yearEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
        OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
      },
      select: { amount: true, type: true, date: true },
    });

    // Parcelas de cartão pagas no ano — contam pelo mês em que foram
    // efetivamente pagas (paidAt), não pelo mês de vencimento na fatura.
    const cardInstallments = await this.prisma.installment.findMany({
      where: { paid: true, paidAt: { gte: yearStart, lt: yearEnd }, transaction: { userId, cardId: { not: null } } },
      select: { amount: true, paidAt: true },
    });

    const monthlyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('pt-BR', { month: 'short' }),
      receitas: 0,
      despesas: 0,
      investido: 0,
    }));

    transactions.forEach((t) => {
      const mIndex = t.date.getMonth();
      const val = Number(t.amount);
      if (t.type === 'INCOME') monthlyFlow[mIndex].receitas += val;
      if (t.type === 'EXPENSE') monthlyFlow[mIndex].despesas += val;
    });

    cardInstallments.forEach((i) => {
      monthlyFlow[i.paidAt!.getMonth()].despesas += Number(i.amount);
    });

    if (investmentAccountIds.length > 0) {
      const transfers = await this.prisma.transfer.findMany({
        where: { toId: { in: investmentAccountIds }, date: { gte: yearStart, lt: yearEnd } },
        select: { amount: true, date: true },
      });
      transfers.forEach((t) => {
        monthlyFlow[t.date.getMonth()].investido += Number(t.amount);
      });
    }

    return monthlyFlow;
  }

  // ITEM 7 — Despesas por categoria com nome e cor
  async getExpensesByCategory(userId: string, month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);

    const [grouped, cardInstallments] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: {
          userId,
          type: 'EXPENSE',
          status: 'PAID',
          cardId: null,
          date: { gte: startDate, lt: endDate },
          categoryId: { not: null },
          OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
        },
        _sum: { amount: true },
      }),
      // Parcelas de cartão pagas no mês — contam pela data em que foram
      // efetivamente pagas (paidAt), não pelo vencimento na fatura.
      this.prisma.installment.findMany({
        where: {
          paid: true,
          paidAt: { gte: startDate, lt: endDate },
          transaction: { userId, cardId: { not: null }, categoryId: { not: null } },
        },
        select: { amount: true, transaction: { select: { categoryId: true } } },
      }),
    ]);

    const totals = new Map<string, number>();
    grouped.forEach((g) => totals.set(g.categoryId!, (totals.get(g.categoryId!) ?? 0) + Number(g._sum.amount ?? 0)));
    cardInstallments.forEach((i) => {
      const categoryId = i.transaction.categoryId!;
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + Number(i.amount));
    });

    if (totals.size === 0) return [];

    const categoryIds = Array.from(totals.keys());

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true, icon: true },
    });

    const catMap = new Map(categories.map((c) => [c.id, c]));

    return Array.from(totals.entries())
      .map(([categoryId, total]) => {
        const cat = catMap.get(categoryId);
        return {
          categoryId,
          name: cat?.name ?? 'Sem categoria',
          color: cat?.color ?? '#64748B',
          icon: cat?.icon ?? 'tag',
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  async getUpcomingBills(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', status: 'PENDING' },
      orderBy: { date: 'asc' },
      take: 5,
      include: { category: true, account: true },
    });
  }

  /**
   * Painel "Pago x Em Aberto": totais pagos/pendentes do mês e a lista de
   * itens em aberto — transações INCOME/EXPENSE com status PENDING mais
   * parcelas de cartão ainda não marcadas como pagas, ambas vencendo no
   * mês/ano selecionado.
   */
  async getPaymentsStatus(userId: string, month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);
    const today = new Date(new Date().setHours(0, 0, 0, 0));

    const [paidAgg, paidCardAgg, pendingTransactions, openInstallments] = await Promise.all([
      // Compras de cartão ficam de fora daqui (cardId: null) — a data delas é
      // o vencimento na fatura, não quando o pagamento saiu da conta. Ver
      // paidCardAgg logo abaixo, que soma pela data real do pagamento.
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          userId,
          status: 'PAID',
          cardId: null,
          date: { gte: startDate, lt: endDate },
          type: { in: ['INCOME', 'EXPENSE'] },
        },
        _sum: { amount: true },
      }),
      // Parcelas de cartão pagas neste mês, pela data real do pagamento
      // (paidAt) — uma parcela pode ser paga antes da fatura fechar.
      this.prisma.installment.aggregate({
        where: { paid: true, paidAt: { gte: startDate, lt: endDate }, transaction: { userId, cardId: { not: null } } },
        _sum: { amount: true },
      }),
      // cardId: null aqui pra não duplicar: compras de cartão pendentes já
      // vêm com todos os detalhes (nome do cartão etc.) via openInstallments.
      this.prisma.transaction.findMany({
        where: {
          userId,
          status: 'PENDING',
          date: { gte: startDate, lt: endDate },
          type: { in: ['INCOME', 'EXPENSE'] },
          cardId: null,
        },
        include: { account: { select: { name: true } }, category: { select: { name: true, color: true } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.installment.findMany({
        where: {
          paid: false,
          dueDate: { gte: startDate, lt: endDate },
          transaction: { userId },
        },
        include: {
          transaction: {
            select: { description: true, card: { select: { name: true, color: true } }, category: { select: { name: true, color: true } } },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const paidExpenseTotal =
      Number(paidAgg.find((g) => g.type === 'EXPENSE')?._sum.amount ?? 0) + Number(paidCardAgg._sum.amount ?? 0);
    const paidIncomeTotal = Number(paidAgg.find((g) => g.type === 'INCOME')?._sum.amount ?? 0);

    const pendingItems = pendingTransactions.map((t) => ({
      id: t.id,
      kind: 'transaction' as const,
      type: t.type,
      description: t.description,
      amount: Number(t.amount),
      dueDate: t.date,
      source: t.account?.name ?? '—',
      category: t.category,
      isOverdue: t.date < today,
    }));

    const installmentItems = openInstallments.map((i) => ({
      id: i.id,
      kind: 'installment' as const,
      type: 'EXPENSE' as const,
      description: `${i.transaction.description.replace(/\s\(\d+\/\d+\)$/, '')} (parcela ${i.number}/${i.totalCount})`,
      amount: Number(i.amount),
      dueDate: i.dueDate,
      source: i.transaction.card?.name ?? '—',
      category: i.transaction.category,
      isOverdue: i.dueDate < today,
    }));

    const openItems = [...pendingItems, ...installmentItems].sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
    );

    const openExpenseTotal =
      pendingItems.filter((i) => i.type === 'EXPENSE').reduce((acc, i) => acc + i.amount, 0) +
      installmentItems.reduce((acc, i) => acc + i.amount, 0);
    const openIncomeTotal = pendingItems.filter((i) => i.type === 'INCOME').reduce((acc, i) => acc + i.amount, 0);

    return {
      paidExpenseTotal,
      paidIncomeTotal,
      openExpenseTotal,
      openIncomeTotal,
      openItems,
    };
  }

  /**
   * Patrimônio total (soma de todas as contas não arquivadas, incluindo
   * investimentos) no fim de cada um dos últimos N meses. Como não guardamos
   * snapshot histórico de saldo, reconstrói cada ponto partindo do saldo
   * atual e revertendo o efeito líquido de tudo que aconteceu depois dele.
   * Transferências entre contas próprias não entram — o efeito se cancela
   * (débito de um lado, crédito do outro), então não mudam o total.
   */
  async getNetWorthTrend(userId: string, months = 12) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { id: true, currentBalance: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const currentTotal = accounts.reduce((acc, a) => acc + Number(a.currentBalance), 0);

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [incomeExpense, cardPayments] = accountIds.length === 0
      ? [[], []]
      : await Promise.all([
          this.prisma.transaction.findMany({
            where: {
              userId,
              status: 'PAID',
              type: { in: ['INCOME', 'EXPENSE'] },
              accountId: { in: accountIds },
              date: { gte: rangeStart },
            },
            select: { amount: true, type: true, date: true },
          }),
          this.prisma.installment.findMany({
            where: { paidFromAccountId: { in: accountIds }, paidAt: { gte: rangeStart } },
            select: { amount: true, paidAt: true },
          }),
        ]);

    const points = Array.from({ length: months }, (_, i) => {
      const offset = months - 1 - i;
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);

      const effectAfter =
        incomeExpense
          .filter((t) => t.date > monthEnd)
          .reduce((acc, t) => acc + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)), 0) +
        cardPayments.filter((p) => p.paidAt! > monthEnd).reduce((acc, p) => acc - Number(p.amount), 0);

      return {
        key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        month: monthDate.toLocaleString('pt-BR', { month: 'short' }),
        netWorth: Math.round((currentTotal - effectAfter) * 100) / 100,
      };
    });

    return points;
  }

  /**
   * Resumo de metas pro widget do dashboard: progresso geral e as metas
   * mais recentes, cada uma com seu percentual individual.
   */
  async getGoalsSummary(userId: string) {
    const goals = await this.prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

    const totalTarget = goals.reduce((acc, g) => acc + Number(g.targetAmount), 0);
    const totalCurrent = goals.reduce((acc, g) => acc + Number(g.currentAmount), 0);

    return {
      count: goals.length,
      totalTarget,
      totalCurrent,
      overallProgress: totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 1000) / 10 : 0,
      goals: goals.slice(0, 4).map((g) => {
        const target = Number(g.targetAmount);
        const current = Number(g.currentAmount);
        return {
          id: g.id,
          name: g.name,
          currentAmount: current,
          targetAmount: target,
          progress: target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0,
          deadline: g.deadline,
        };
      }),
    };
  }
}