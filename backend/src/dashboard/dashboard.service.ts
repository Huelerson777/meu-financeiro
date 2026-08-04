import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string, month?: number, year?: number) {
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();

    // Primeiro dia do mês e primeiro dia do mês seguinte (para o filtro "menor que")
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 1);

    const dateFilter = { gte: startDate, lt: endDate };

    const [
      balanceAgg,
      incomeAgg,
      expenseAgg,
      cardsAgg,
      investments,
      goalsCount,
    ] = await Promise.all([
      this.prisma.account.aggregate({
        where: { userId, isArchived: false },
        _sum: { currentBalance: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'PAID', date: dateFilter },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', status: 'PAID', date: dateFilter },
        _sum: { amount: true },
      }),
      this.prisma.card.aggregate({
        where: { userId, isArchived: false },
        _sum: { usedLimit: true, limitAmount: true },
      }),
      // Busca os investimentos do mês para somar (quantidade * preço médio)
      this.prisma.investment.findMany({
        where: { userId, createdAt: dateFilter },
        select: { quantity: true, averagePrice: true },
      }),
      this.prisma.goal.count({ where: { userId } }),
    ]);

    const currentBalance = Number(balanceAgg._sum.currentBalance ?? 0);
    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);
    
    // Calcula o total investido no mês
    const totalInvested = investments.reduce(
      (acc, inv) => acc + (Number(inv.quantity) * Number(inv.averagePrice)),
      0
    );

    const leftovers = totalIncome - totalExpense - totalInvested;

    return {
      currentBalance,
      totalIncome,
      totalExpense,
      totalInvested,
      leftovers, // Nossas "Sobras"
      cardsUsedLimit: Number(cardsAgg._sum.usedLimit ?? 0),
      cardsTotalLimit: Number(cardsAgg._sum.limitAmount ?? 0),
      goalsCount,
    };
  }

  async getMonthlyFlow(userId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1); // 1 de Janeiro
    const endDate = new Date(targetYear + 1, 0, 1); // 1 de Jan do próximo ano

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        date: { gte: startDate, lt: endDate },
        type: { in: ['INCOME', 'EXPENSE'] },
      },
      select: { amount: true, type: true, date: true },
    });

    // Inicializa os 12 meses zerados
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(targetYear, i).toLocaleString('pt-BR', { month: 'short' }),
      receitas: 0,
      despesas: 0,
    }));

    // Preenche com os dados reais
    transactions.forEach((t) => {
      const monthIndex = t.date.getMonth();
      const value = Number(t.amount);
      if (t.type === 'INCOME') monthlyData[monthIndex].receitas += value;
      if (t.type === 'EXPENSE') monthlyData[monthIndex].despesas += value;
    });

    return monthlyData;
  }

  async getExpensesByCategory(userId: string) {
    return this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE' },
      _sum: { amount: true },
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