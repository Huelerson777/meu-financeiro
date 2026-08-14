import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Resolve o período do relatório: usa as datas informadas ou, na
   * ausência delas, cai no mês corrente — mesmo padrão do Dashboard.
   */
  private resolveRange(startDate?: string, endDate?: string): DateRange {
    const now = new Date();
    const start = startDate
      ? new Date(`${startDate}T00:00:00.000Z`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(`${endDate}T23:59:59.999Z`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Fluxo de caixa do período: totais de receita/despesa/saldo e uma série
   * temporal (diária se o período for curto, mensal se for longo).
   */
  async getCashFlow(userId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'PAID',
        type: { in: ['INCOME', 'EXPENSE'] },
        date: { gte: start, lte: end },
      },
      select: { amount: true, type: true, date: true },
      orderBy: { date: 'asc' },
    });

    const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((a, t) => a + Number(t.amount), 0);
    const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((a, t) => a + Number(t.amount), 0);

    const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const groupByMonth = spanDays > 62;

    const seriesMap = new Map<string, { key: string; receitas: number; despesas: number }>();
    transactions.forEach((t) => {
      const key = groupByMonth
        ? `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
        : `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}-${String(t.date.getDate()).padStart(2, '0')}`;
      if (!seriesMap.has(key)) seriesMap.set(key, { key, receitas: 0, despesas: 0 });
      const bucket = seriesMap.get(key)!;
      if (t.type === 'INCOME') bucket.receitas += Number(t.amount);
      else bucket.despesas += Number(t.amount);
    });

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      series: Array.from(seriesMap.values()).sort((a, b) => (a.key < b.key ? -1 : 1)),
    };
  }

  /**
   * Receitas ou despesas agrupadas por categoria no período, com percentual
   * de participação no total — base pro gráfico de pizza/barras do relatório.
   */
  async getByCategory(userId: string, startDate?: string, endDate?: string, type: TransactionType = 'EXPENSE') {
    const { start, end } = this.resolveRange(startDate, endDate);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, status: 'PAID', type, date: { gte: start, lte: end }, categoryId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    const categoryIds = grouped.map((g) => g.categoryId).filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true, icon: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    const total = grouped.reduce((acc, g) => acc + Number(g._sum.amount ?? 0), 0);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      type,
      total,
      items: grouped.map((g) => {
        const cat = catMap.get(g.categoryId!);
        const amount = Number(g._sum.amount ?? 0);
        return {
          categoryId: g.categoryId,
          name: cat?.name ?? 'Sem categoria',
          color: cat?.color ?? '#64748B',
          icon: cat?.icon ?? 'tag',
          amount,
          percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
        };
      }),
    };
  }

  /**
   * Extrato de uma conta: saldo inicial do período + lançamentos em ordem
   * cronológica com saldo corrente após cada um. Inclui receitas/despesas,
   * transferências (enviadas e recebidas) e pagamentos de fatura de cartão
   * feitos a partir dessa conta.
   */
  async getAccountStatement(userId: string, accountId: string, startDate?: string, endDate?: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Conta não encontrada');

    const { start, end } = this.resolveRange(startDate, endDate);

    type Entry = { date: Date; description: string; amount: number; kind: string };

    // Tudo desde o início do período até agora, pra conseguir calcular o
    // saldo inicial revertendo o efeito líquido a partir do saldo atual.
    const [ownTx, incomingTransfers, cardPayments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, accountId, status: 'PAID', type: { in: ['INCOME', 'EXPENSE', 'TRANSFER'] }, date: { gte: start } },
        select: { description: true, amount: true, type: true, date: true },
      }),
      this.prisma.transfer.findMany({
        where: { toId: accountId, date: { gte: start } },
        select: { description: true, amount: true, date: true },
      }),
      this.prisma.installment.findMany({
        where: { paidFromAccountId: accountId, paidAt: { gte: start } },
        include: { transaction: { select: { description: true } } },
      }),
    ]);

    const entries: Entry[] = [
      ...ownTx.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount),
        kind: t.type === 'TRANSFER' ? 'Transferência enviada' : t.type === 'INCOME' ? 'Receita' : 'Despesa',
      })),
      ...incomingTransfers.map((t) => ({
        date: t.date,
        description: t.description || 'Transferência recebida',
        amount: Number(t.amount),
        kind: 'Transferência recebida',
      })),
      ...cardPayments.map((i) => ({
        date: i.paidAt!,
        description: `Pagamento fatura: ${i.transaction.description}`,
        amount: -Number(i.amount),
        kind: 'Pagamento de fatura',
      })),
    ];

    const netSinceStart = entries.reduce((acc, e) => acc + e.amount, 0);
    const openingBalance = Number(account.currentBalance) - netSinceStart;

    const inRange = entries
      .filter((e) => e.date <= end)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let running = openingBalance;
    const lines = inRange.map((e) => {
      running += e.amount;
      return { ...e, balanceAfter: running };
    });

    return {
      account: { id: account.id, name: account.name },
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      openingBalance,
      closingBalance: running,
      lines,
    };
  }

  /**
   * Exporta as transações (receitas/despesas/transferências) do período em
   * CSV — pra abrir em Excel/Sheets.
   */
  async exportTransactionsCsv(userId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.resolveRange(startDate, endDate);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: { account: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Status', 'Valor'];
    const rows = transactions.map((t) => [
      t.date.toISOString().split('T')[0],
      escape(t.description),
      t.type,
      escape(t.category?.name ?? ''),
      escape(t.account?.name ?? ''),
      t.status,
      Number(t.amount).toFixed(2),
    ]);

    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const filename = `transacoes_${start.toISOString().split('T')[0]}_a_${end.toISOString().split('T')[0]}.csv`;

    return { csv, filename };
  }
}
