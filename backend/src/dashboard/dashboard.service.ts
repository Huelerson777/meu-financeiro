import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Agrega dados de múltiplos módulos para alimentar os cards e gráficos
 * do Dashboard principal. Ponto de extensão natural para cache (Redis)
 * no futuro, já que os dados mudam com pouca frequência intradiária.
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string) {
    const [balanceAgg, incomeAgg, expenseAgg, cardsAgg, goalsCount] = await Promise.all([
      this.prisma.account.aggregate({
        where: { userId, isArchived: false },
        _sum: { currentBalance: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', status: 'PAID' },
        _sum: { amount: true },
      }),
      this.prisma.card.aggregate({
        where: { userId, isArchived: false },
        _sum: { usedLimit: true, limitAmount: true },
      }),
      this.prisma.goal.count({ where: { userId } }),
    ]);

    return {
      currentBalance: balanceAgg._sum.currentBalance ?? 0,
      totalIncome: incomeAgg._sum.amount ?? 0,
      totalExpense: expenseAgg._sum.amount ?? 0,
      cardsUsedLimit: cardsAgg._sum.usedLimit ?? 0,
      cardsTotalLimit: cardsAgg._sum.limitAmount ?? 0,
      goalsCount,
    };
  }

  async getExpensesByCategory(userId: string) {
    const result = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE' },
      _sum: { amount: true },
    });
    return result;
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
