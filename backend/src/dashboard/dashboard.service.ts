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

    const [
      balanceAgg,
      incomeAgg,
      expenseAgg,
      investments,
    ] = await Promise.all([
      this.prisma.account.aggregate({
        // Filtra apenas contas que o usuário quer ver no dashboard
        where: { userId, isArchived: false, includeInDashboard: true },
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
      this.prisma.investment.findMany({
        where: { userId, createdAt: dateFilter },
        select: { quantity: true, averagePrice: true },
      }),
    ]);

    const currentBalance = Number(balanceAgg._sum.currentBalance ?? 0);
    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);
    
    const totalInvested = investments.reduce(
      (acc, inv) => acc + (Number(inv.quantity) * Number(inv.averagePrice)),
      0
    );

    const leftovers = totalIncome - totalExpense - totalInvested;

    // Busca a evolução anual verdadeira
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);
    
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        date: { gte: yearStart, lt: yearEnd },
        type: { in: ['INCOME', 'EXPENSE'] },
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

    return {
      currentBalance,
      totalIncome,
      totalExpense,
      totalInvested,
      leftovers,
      monthlyFlow, // Agora os dados reais vão para o frontend
    };
  }

  // Mantenha o restante (getExpensesByCategory, getUpcomingBills) igual...
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