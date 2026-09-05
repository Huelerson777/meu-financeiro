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
 * Investimentos aqui = aportes feitos via transferência para contas do tipo
 * INVESTMENT (mesmo fluxo já usado na tela de Transações > "Investir").
 * Não há controle de ativos/portfólio — apenas o histórico e total aportado,
 * já que o que importa pro usuário é acompanhar quanto foi investido por mês.
 *
 * Quem quiser acompanhar o rendimento de um ativo específico (CDB, ação...)
 * pode opcionalmente registrar uma "posição" (ver *Position abaixo) — o
 * aporte simples acima continua funcionando exatamente igual, sem nenhuma
 * posição vinculada.
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

    const transfers = await this.prisma.transfer.findMany({
      where: {
        toId: { in: investmentAccountIds },
        ...(filters?.startDate || filters?.endDate
          ? {
              date: {
                ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
                ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
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

  /**
   * Registra um aporte já vinculado a um ativo específico: cria a
   * transferência (mesmo caminho do aporte simples, via AccountsService)
   * e a posição (Investment) linkada a ela na mesma operação.
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

    const transfer = await this.accountsService.transfer(userId, {
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: dto.amount,
      description: dto.description || `Aporte: ${dto.name}`,
    });

    return this.prisma.investment.create({
      data: {
        userId,
        accountId: dto.toAccountId,
        transferId: transfer.id,
        name: dto.name,
        category: dto.category,
        ticker: dto.ticker,
        quantity,
        averagePrice,
        currentPrice: averagePrice,
        indexer: dto.category === 'FIXED_INCOME' ? dto.indexer : undefined,
        rate: dto.category === 'FIXED_INCOME' ? dto.rate : undefined,
        startDate: dto.category === 'FIXED_INCOME' ? startDate : undefined,
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

  async updatePosition(id: string, userId: string, dto: UpdatePositionDto) {
    await this.assertOwnership(id, userId);

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
        ...(dto.currentPrice != null ? { lastValuedAt: new Date() } : {}),
      },
    });
  }

  /**
   * Remove a posição e o aporte (Transfer) que a originou — os dois nascem
   * juntos em createPosition, então saem juntos aqui também.
   */
  async deletePosition(id: string, userId: string) {
    const position = await this.assertOwnership(id, userId);

    if (position.transferId) {
      await this.accountsService.removeTransfer(position.transferId, userId);
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
