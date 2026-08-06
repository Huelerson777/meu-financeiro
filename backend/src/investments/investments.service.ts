import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Investimentos aqui = aportes feitos via transferência para contas do tipo
 * INVESTMENT (mesmo fluxo já usado na tela de Transações > "Investir").
 * Não há controle de ativos/portfólio — apenas o histórico e total aportado,
 * já que o que importa pro usuário é acompanhar quanto foi investido por mês.
 */
@Injectable()
export class InvestmentsService {
  constructor(private prisma: PrismaService) {}

  private async getInvestmentAccountIds(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, type: 'INVESTMENT' },
      select: { id: true, name: true, color: true },
    });
    return accounts;
  }

  async getContributions(userId: string) {
    const investmentAccounts = await this.getInvestmentAccountIds(userId);
    const investmentAccountIds = investmentAccounts.map((a) => a.id);

    if (investmentAccountIds.length === 0) {
      return { totalInvested: 0, monthly: [], contributions: [], investmentAccounts: [] };
    }

    const transfers = await this.prisma.transfer.findMany({
      where: { toId: { in: investmentAccountIds } },
      orderBy: { date: 'desc' },
      include: {
        fromAccount: { select: { name: true } },
        toAccount: { select: { name: true, color: true } },
      },
    });

    const totalInvested = transfers.reduce((acc, t) => acc + Number(t.amount), 0);

    // Agrupa por mês/ano para o histórico resumido
    const monthlyMap = new Map<string, number>();
    transfers.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(t.amount));
    });

    const monthly = Array.from(monthlyMap.entries())
      .map(([key, total]) => ({ month: key, total }))
      .sort((a, b) => (a.month > b.month ? -1 : 1));

    const contributions = transfers.map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      description: t.description,
      fromAccountName: t.fromAccount.name,
      toAccountName: t.toAccount.name,
      toAccountColor: t.toAccount.color,
    }));

    return { totalInvested, monthly, contributions, investmentAccounts };
  }
}
