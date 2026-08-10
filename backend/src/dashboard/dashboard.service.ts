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

    const [balanceAgg, incomeAgg, expenseAgg, investedAgg] = await Promise.all([
      // ITEM 1/6 - Saldo geral filtra por includeInDashboard
      this.prisma.account.aggregate({
        where: { userId, isArchived: false, includeInDashboard: true },
        _sum: { currentBalance: true },
      }),
      // Receitas do mês — só de contas "No controle de saldo" (includeInDashboard)
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          status: 'PAID',
          date: dateFilter,
          account: { includeInDashboard: true },
        },
        _sum: { amount: true },
      }),
      // Despesas do mês — de contas "No controle de saldo" OU compras de cartão
      // (que não têm conta vinculada, só cardId, e sempre contam)
      this.prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          status: 'PAID',
          date: dateFilter,
          OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
          // Se há contas de investimento, exclui despesas nessas contas (aportes)
          ...(investmentAccountIds.length > 0
            ? { NOT: { accountId: { in: investmentAccountIds } } }
            : {}),
        },
        _sum: { amount: true },
      }),
      // ITEM 2 - Investimentos = transferências recebidas em contas do tipo INVESTMENT no mês
      investmentAccountIds.length > 0
        ? this.prisma.transaction.aggregate({
            where: {
              userId,
              type: 'TRANSFER',
              status: 'PAID',
              date: dateFilter,
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
    ]);

    // ITEM 2 — cálculo correto de investimentos via tabela Transfer (transação atômica)
    let totalInvested = 0;
    if (investmentAccountIds.length > 0) {
      const transfersToInvestment = await this.prisma.transfer.aggregate({
        where: {
          toId: { in: investmentAccountIds },
          date: dateFilter,
        },
        _sum: { amount: true },
      });
      totalInvested = Number(transfersToInvestment._sum.amount ?? 0);
    }

    const currentBalance = Number(balanceAgg._sum.currentBalance ?? 0);
    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);
    const leftovers = totalIncome - totalExpense - totalInvested;

    // ITEM 4 — Evolução anual com dados reais, buscando o ano inteiro
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    const yearTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        date: { gte: yearStart, lt: yearEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
        OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
      },
      select: { amount: true, type: true, date: true },
    });

    const monthlyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('pt-BR', { month: 'short' }),
      receitas: 0,
      despesas: 0,
    }));

    yearTransactions.forEach((t) => {
      const mIndex = t.date.getMonth();
      const val = Number(t.amount);
      if (t.type === 'INCOME') monthlyFlow[mIndex].receitas += val;
      if (t.type === 'EXPENSE') monthlyFlow[mIndex].despesas += val;
    });

    return {
      currentBalance,
      totalIncome,
      totalExpense,
      totalInvested,
      leftovers,
      monthlyFlow,
    };
  }

  // ITEM 4 — endpoint separado para evolução anual (mantido compatível)
  async getMonthlyFlow(userId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        date: { gte: yearStart, lt: yearEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
        OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
      },
      select: { amount: true, type: true, date: true },
    });

    const monthlyFlow = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('pt-BR', { month: 'short' }),
      receitas: 0,
      despesas: 0,
    }));

    transactions.forEach((t) => {
      const mIndex = t.date.getMonth();
      const val = Number(t.amount);
      if (t.type === 'INCOME') monthlyFlow[mIndex].receitas += val;
      if (t.type === 'EXPENSE') monthlyFlow[mIndex].despesas += val;
    });

    return monthlyFlow;
  }

  // ITEM 7 — Despesas por categoria com nome e cor
  async getExpensesByCategory(userId: string, month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        status: 'PAID',
        date: { gte: startDate, lt: endDate },
        categoryId: { not: null },
        OR: [{ account: { includeInDashboard: true } }, { accountId: null }],
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (grouped.length === 0) return [];

    const categoryIds = grouped
      .map((g) => g.categoryId)
      .filter(Boolean) as string[];

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true, icon: true },
    });

    const catMap = new Map(categories.map((c) => [c.id, c]));

    return grouped.map((g) => {
      const cat = catMap.get(g.categoryId!);
      return {
        categoryId: g.categoryId,
        name: cat?.name ?? 'Sem categoria',
        color: cat?.color ?? '#64748B',
        icon: cat?.icon ?? 'tag',
        total: Number(g._sum.amount ?? 0),
      };
    });
  }

  async getUpcomingBills(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', status: 'PENDING' },
      orderBy: { date: 'asc' },
      take: 5,
      include: { category: true, account: true },
    });
  }
}