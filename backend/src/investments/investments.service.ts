import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvestmentCategory } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { BacenService } from './rate-sources/bacen.service';
import { BrapiService } from './rate-sources/brapi.service';
import { calculateAccruedValue } from './accrual.util';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

/**
 * Aporte simples = transferência pra uma conta do tipo INVESTMENT.
 * Aporte com ativo (createPosition) além disso cria uma posição (Investment)
 * pra acompanhar rendimento — com transferência real (dinheiro saindo de uma
 * conta) ou, pra ativo que o usuário já possuía antes do app, só crédito
 * direto no saldo da conta de investimento, sem débito em nenhuma outra.
 * Nos dois casos o valor entra no total investido/aportes por mês — ver
 * getContributions, que soma Transfer + Investment sem transferId.
 */
@Injectable()
export class InvestmentsService {
  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
    private bacenService: BacenService,
    private brapiService: BrapiService,
  ) {}

  private async getInvestmentAccountIds(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, type: 'INVESTMENT' },
      select: { id: true, name: true, color: true },
    });
    return accounts;
  }

  async getContributions(userId: string, filters?: { startDate?: string; endDate?: string }) {
    const investmentAccounts = await this.getInvestmentAccountIds(userId);
    const investmentAccountIds = investmentAccounts.map((a) => a.id);

    if (investmentAccountIds.length === 0) {
      return { totalInvested: 0, monthly: [], contributions: [], investmentAccounts: [] };
    }

    const dateRange =
      filters?.startDate || filters?.endDate
        ? {
            ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
            ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}),
          }
        : undefined;

    const [transfers, standalonePositions] = await Promise.all([
      this.prisma.transfer.findMany({
        where: {
          toId: { in: investmentAccountIds },
          ...(dateRange ? { date: dateRange } : {}),
        },
        include: {
          fromAccount: { select: { name: true } },
          toAccount: { select: { name: true, color: true } },
        },
      }),
      // Ativos registrados como "já possuía" (sem transferência) — contam como
      // aporte pela data de compra informada, mesmo sem movimentar conta.
      this.prisma.investment.findMany({
        where: {
          userId,
          transferId: null,
          ...(dateRange ? { startDate: dateRange } : {}),
        },
        include: { account: { select: { name: true, color: true } } },
      }),
    ]);

    const transferContributions = transfers.map((t) => ({
      id: t.id,
      date: t.date,
      amount: Number(t.amount),
      description: t.description,
      fromAccountName: t.fromAccount.name,
      toAccountName: t.toAccount.name,
      toAccountColor: t.toAccount.color,
    }));

    const positionContributions = standalonePositions.map((p) => ({
      id: p.id,
      date: p.startDate ?? p.createdAt,
      amount: Number(p.quantity) * Number(p.averagePrice),
      description: p.name,
      fromAccountName: 'Ativo já possuído',
      toAccountName: p.account.name,
      toAccountColor: p.account.color,
    }));

    const contributions = [...transferContributions, ...positionContributions].sort((a, b) =>
      a.date > b.date ? -1 : 1,
    );

    const totalInvested = contributions.reduce((acc, c) => acc + c.amount, 0);

    // Agrupa por mês/ano para o histórico resumido
    const monthlyMap = new Map<string, number>();
    contributions.forEach((c) => {
      const key = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + c.amount);
    });

    const monthly = Array.from(monthlyMap.entries())
      .map(([key, total]) => ({ month: key, total }))
      .sort((a, b) => (a.month > b.month ? -1 : 1));

    return { totalInvested, monthly, contributions, investmentAccounts };
  }

  /**
   * Registra um aporte vinculado a um ativo específico. Quando `fromAccountId`
   * vem preenchido, cria a transferência (mesmo caminho do aporte simples, via
   * AccountsService) e a posição (Investment) linkada a ela na mesma operação.
   * Quando vem vazio (ativo que o usuário já possuía antes de usar o app), não
   * há transferência — mas o saldo da conta de investimento é creditado do
   * mesmo jeito, e o valor entra no total investido/aportes por mês, já que
   * pra quem vê a tela o ativo passa a "estar" naquela conta.
   */
  async createPosition(userId: string, dto: CreatePositionDto) {
    const toAccount = await this.prisma.account.findFirst({ where: { id: dto.toAccountId, userId } });
    if (!toAccount) throw new NotFoundException('Conta de destino não encontrada');
    if (toAccount.type !== 'INVESTMENT') {
      throw new BadRequestException('A conta de destino precisa ser do tipo Investimento');
    }

    const { quantity, averagePrice } = this.resolveQuantityAndPrice(dto);
    const startDate = this.parseDateOnly(dto.startDate ?? dto.date ?? this.todayIsoDate());

    if (dto.category === 'FIXED_INCOME' && (!dto.indexer || dto.rate == null)) {
      throw new BadRequestException('Renda fixa precisa de indexador e taxa contratada');
    }

    let transferId: string | undefined;
    if (dto.fromAccountId) {
      transferId = (
        await this.accountsService.transfer(userId, {
          fromAccountId: dto.fromAccountId,
          toAccountId: dto.toAccountId,
          amount: dto.amount,
          description: dto.description || `Aporte: ${dto.name}`,
        })
      ).id;
    } else {
      await this.prisma.account.update({
        where: { id: dto.toAccountId },
        data: { currentBalance: { increment: dto.amount } },
      });
    }

    return this.prisma.investment.create({
      data: {
        userId,
        accountId: dto.toAccountId,
        transferId,
        name: dto.name,
        category: dto.category,
        ticker: dto.ticker,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        indexer: dto.category === 'FIXED_INCOME' ? dto.indexer : undefined,
        rate: dto.category === 'FIXED_INCOME' ? dto.rate : undefined,
        startDate,
      },
    });
  }

  /**
   * Lista as posições do usuário recalculando o valor atual — renda fixa
   * via índices do Banco Central, ações/fundos com ticker via brapi.dev —
   * e persiste o resultado (mesmo padrão de "sync ao abrir a tela" usado em
   * RecurringBillsService.sync / CardsService.syncRecurringPurchases: sem
   * cron, recalcula sob demanda).
   */
  async listPositions(userId: string) {
    const positions = await this.prisma.investment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const updated = await Promise.all(positions.map((position) => this.refreshPosition(position)));

    return updated.map((p) => {
      const invested = Number(p.quantity) * Number(p.averagePrice);
      const current = Number(p.quantity) * Number(p.currentPrice);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        ticker: p.ticker,
        indexer: p.indexer,
        rate: p.rate ? Number(p.rate) : null,
        startDate: p.startDate,
        quantity: Number(p.quantity),
        averagePrice: Number(p.averagePrice),
        currentPrice: Number(p.currentPrice),
        invested,
        current,
        profit: current - invested,
        profitPct: invested > 0 ? ((current - invested) / invested) * 100 : 0,
        lastValuedAt: p.lastValuedAt,
      };
    });
  }

  private async refreshPosition(position: {
    id: string;
    category: InvestmentCategory;
    ticker: string | null;
    indexer: string | null;
    rate: unknown;
    startDate: Date | null;
    averagePrice: unknown;
    currentPrice: unknown;
  }) {
    if (position.category === 'FIXED_INCOME' && position.indexer && position.rate != null && position.startDate) {
      const currentValue = await this.calculateFixedIncomeValue({
        indexer: position.indexer as 'CDI' | 'SELIC' | 'IPCA_PLUS' | 'PREFIXADO',
        rate: Number(position.rate),
        principal: Number(position.averagePrice),
        startDate: position.startDate,
      });
      return this.prisma.investment.update({
        where: { id: position.id },
        data: { currentPrice: currentValue, lastValuedAt: new Date() },
      });
    }

    if ((position.category === 'STOCK' || position.category === 'FUND') && position.ticker) {
      const price = await this.brapiService.getQuote(position.ticker);
      if (price != null) {
        return this.prisma.investment.update({
          where: { id: position.id },
          data: { currentPrice: price, lastValuedAt: new Date() },
        });
      }
    }

    // Sem fonte automática (CRYPTO/REAL_ESTATE/OTHER, ou STOCK/FUND sem
    // ticker, ou falha ao buscar cotação) — mantém o valor manual como está.
    return this.prisma.investment.findUniqueOrThrow({ where: { id: position.id } });
  }

  private async calculateFixedIncomeValue(params: {
    indexer: 'CDI' | 'SELIC' | 'IPCA_PLUS' | 'PREFIXADO';
    rate: number;
    principal: number;
    startDate: Date;
  }): Promise<number> {
    const today = new Date();
    const dailySeries =
      params.indexer === 'CDI' || params.indexer === 'SELIC'
        ? await this.bacenService.getSeries(params.indexer, params.startDate, today)
        : undefined;
    const monthlySeries =
      params.indexer === 'IPCA_PLUS' ? await this.bacenService.getSeries('IPCA', params.startDate, today) : undefined;

    return calculateAccruedValue({
      indexer: params.indexer,
      rate: params.rate,
      principal: params.principal,
      startDate: params.startDate,
      today,
      dailySeries,
      monthlySeries,
    });
  }

  /**
   * Edita uma posição — inclusive quantidade e preço médio, o que permite
   * "zerar" (quantity: 0) pra marcar como vendida sem excluir o histórico.
   * Numa posição sem transferência (ativo "já possuía"), o saldo da conta foi
   * creditado direto na criação (ver createPosition) — se o valor investido
   * muda aqui, ajusta o saldo pela mesma diferença, senão saldo e total
   * investido divergem do que a posição passa a mostrar.
   */
  async updatePosition(id: string, userId: string, dto: UpdatePositionDto) {
    const position = await this.assertOwnership(id, userId);

    if (!position.transferId && (dto.quantity != null || dto.averagePrice != null)) {
      const oldInvested = Number(position.quantity) * Number(position.averagePrice);
      const newInvested = (dto.quantity ?? Number(position.quantity)) * (dto.averagePrice ?? Number(position.averagePrice));
      const delta = newInvested - oldInvested;
      if (delta !== 0) {
        await this.prisma.account.update({
          where: { id: position.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }
    }

    return this.prisma.investment.update({
      where: { id },
      data: {
        name: dto.name,
        ticker: dto.ticker,
        indexer: dto.indexer,
        rate: dto.rate,
        startDate: dto.startDate ? this.parseDateOnly(dto.startDate) : undefined,
        currentPrice: dto.currentPrice,
        quantity: dto.quantity,
        averagePrice: dto.averagePrice,
        ...(dto.currentPrice != null ? { lastValuedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Remove a posição e o aporte (Transfer) que a originou — os dois nascem
   * juntos em createPosition, então saem juntos aqui também. Pra posição sem
   * transferência (ativo "já possuía"), desfaz em vez disso o crédito direto
   * que createPosition deu no saldo da conta.
   */
  async deletePosition(id: string, userId: string) {
    const position = await this.assertOwnership(id, userId);

    if (position.transferId) {
      await this.accountsService.removeTransfer(position.transferId, userId);
    } else {
      const invested = Number(position.quantity) * Number(position.averagePrice);
      await this.prisma.account.update({
        where: { id: position.accountId },
        data: { currentBalance: { decrement: invested } },
      });
    }
    await this.prisma.investment.delete({ where: { id } });

    return { deleted: true };
  }

  private async assertOwnership(id: string, userId: string) {
    const position = await this.prisma.investment.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Posição não encontrada');
    if (position.userId !== userId) throw new ForbiddenException('Esta posição não pertence a você');
    return position;
  }

  private resolveQuantityAndPrice(dto: CreatePositionDto): { quantity: number; averagePrice: number } {
    if (dto.category === 'STOCK' || dto.category === 'FUND') {
      const quantity = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;
      return { quantity, averagePrice: Math.round((dto.amount / quantity) * 100) / 100 };
    }
    // FIXED_INCOME/CRYPTO/REAL_ESTATE/OTHER: 1 "unidade" cujo preço é o próprio valor aportado.
    return { quantity: 1, averagePrice: dto.amount };
  }

  private todayIsoDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Converte um "YYYY-MM-DD" pro dia local certo (mesma lógica usada em
   * cards.service.ts) — evita o troca-de-dia por fuso ao usar `new Date(str)`.
   */
  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date(value);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
}
