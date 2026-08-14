import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PayInstallmentDto } from './dto/pay-installment.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.card.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const card = await this.prisma.card.findFirst({ where: { id, userId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    return card;
  }

  create(userId: string, dto: CreateCardDto) {
    return this.prisma.card.create({
      data: {
        userId,
        name: dto.name,
        limitAmount: dto.limitAmount,
        closingDay: dto.closingDay,
        dueDay: dto.dueDay,
        color: dto.color,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateCardDto) {
    await this.assertOwnership(id, userId);
    return this.prisma.card.update({ where: { id }, data: dto });
  }

  async archive(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.prisma.card.update({ where: { id }, data: { isArchived: true } });
  }

  /**
   * Lança uma compra parcelada no cartão:
   * - Cria N transações de despesa (uma por parcela), cada uma "caindo" no
   *   mês correto da fatura em que ela vence.
   * - Sobe o limite usado do cartão pelo valor TOTAL da compra de uma vez
   *   (é assim que limite de cartão de crédito funciona de verdade).
   */
  async createPurchase(cardId: string, userId: string, dto: CreatePurchaseDto) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
    if (card.isArchived) throw new BadRequestException('Este cartão está arquivado');

    const availableLimit = Number(card.limitAmount) - Number(card.usedLimit);
    if (dto.totalAmount > availableLimit) {
      throw new BadRequestException(
        `Limite insuficiente. Disponível: R$ ${availableLimit.toFixed(2)}, compra: R$ ${dto.totalAmount.toFixed(2)}`,
      );
    }

    const installmentAmounts = this.splitAmount(dto.totalAmount, dto.installmentsCount);
    const purchaseDate = new Date(dto.purchaseDate);
    const installmentGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const createdTransactions = [];

      for (let i = 0; i < dto.installmentsCount; i++) {
        const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.dueDay, i);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            cardId,
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            status: 'PENDING', // vira PAID quando a parcela é efetivamente paga (ver payInstallment/payInvoice)
            description: `${dto.description} (${i + 1}/${dto.installmentsCount})`,
            amount: installmentAmounts[i],
            date: dueDate,
            isInstallment: true,
            installmentGroupId,
          },
        });

        await tx.installment.create({
          data: {
            transactionId: transaction.id,
            number: i + 1,
            totalCount: dto.installmentsCount,
            amount: installmentAmounts[i],
            dueDate,
            paid: false,
          },
        });

        createdTransactions.push(transaction);
      }

      await tx.card.update({
        where: { id: cardId },
        data: { usedLimit: { increment: dto.totalAmount } },
      });

      return { installmentGroupId, transactions: createdTransactions };
    });
  }

  /**
   * Agrupa todas as parcelas do cartão por mês de vencimento — a "fatura"
   * de cada mês, com o total e os itens que a compõem.
   */
  async getInvoices(cardId: string, userId: string) {
    await this.assertOwnership(cardId, userId);

    const transactions = await this.prisma.transaction.findMany({
      where: { cardId, userId },
      include: {
        category: { select: { name: true, color: true } },
        installments: {
          select: { id: true, paid: true, dueDate: true, paidAt: true, paidFromAccount: { select: { name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    const invoicesMap = new Map<string, { month: string; total: number; openTotal: number; items: any[] }>();

    transactions.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      if (!invoicesMap.has(key)) {
        invoicesMap.set(key, { month: key, total: 0, openTotal: 0, items: [] });
      }
      const invoice = invoicesMap.get(key)!;
      const installment = t.installments[0];
      const paid = installment?.paid ?? false;
      const amount = Number(t.amount);
      invoice.total += amount;
      if (!paid) invoice.openTotal += amount;
      invoice.items.push({
        id: t.id,
        description: t.description,
        amount,
        date: t.date,
        category: t.category,
        categoryId: t.categoryId,
        installmentGroupId: t.installmentGroupId,
        installmentId: installment?.id ?? null,
        paid,
        paidAt: installment?.paidAt ?? null,
        paidFromAccountName: installment?.paidFromAccount?.name ?? null,
      });
    });

    return Array.from(invoicesMap.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
  }

  /**
   * Paga uma parcela individual: debita o valor da conta escolhida e marca a
   * parcela como paga, guardando de qual conta saiu o dinheiro (pra permitir
   * desfazer depois). Não afeta o limite do cartão — o limite já subiu
   * inteiro no momento da compra.
   */
  async payInstallment(installmentId: string, userId: string, dto: PayInstallmentDto) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: { transaction: { select: { userId: true, description: true } } },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');
    if (installment.transaction.userId !== userId) {
      throw new ForbiddenException('Esta parcela não pertence a você');
    }
    if (installment.paid) throw new BadRequestException('Esta parcela já está paga');

    const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } });
    if (!account) throw new NotFoundException('Conta não encontrada');

    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: dto.accountId },
        data: { currentBalance: { decrement: installment.amount } },
      });

      await tx.transaction.update({
        where: { id: installment.transactionId },
        data: { status: 'PAID' },
      });

      return tx.installment.update({
        where: { id: installmentId },
        data: { paid: true, paidFromAccountId: dto.accountId, paidAt: dto.date ? new Date(dto.date) : new Date() },
      });
    });
  }

  /**
   * Desfaz o pagamento de uma parcela: devolve o valor pra conta de onde
   * saiu e volta o status pra "em aberto".
   */
  async unpayInstallment(installmentId: string, userId: string) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: { transaction: { select: { userId: true } } },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');
    if (installment.transaction.userId !== userId) {
      throw new ForbiddenException('Esta parcela não pertence a você');
    }
    if (!installment.paid) throw new BadRequestException('Esta parcela ainda não está paga');

    return this.prisma.$transaction(async (tx) => {
      if (installment.paidFromAccountId) {
        await tx.account.update({
          where: { id: installment.paidFromAccountId },
          data: { currentBalance: { increment: installment.amount } },
        });
      }

      await tx.transaction.update({
        where: { id: installment.transactionId },
        data: { status: 'PENDING' },
      });

      return tx.installment.update({
        where: { id: installmentId },
        data: { paid: false, paidFromAccountId: null, paidAt: null },
      });
    });
  }

  /**
   * Paga de uma vez todas as parcelas em aberto da fatura de um mês: soma só
   * as parcelas ainda não pagas (uma parcela paga avulsa não entra de novo
   * no total, já está liquidada) e debita o total da conta escolhida.
   */
  async payInvoice(cardId: string, userId: string, dto: PayInvoiceDto) {
    await this.assertOwnership(cardId, userId);

    const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } });
    if (!account) throw new NotFoundException('Conta não encontrada');

    const [year, month] = dto.month.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const openInstallments = await this.prisma.installment.findMany({
      where: { paid: false, dueDate: { gte: startDate, lt: endDate }, transaction: { cardId, userId } },
    });

    if (openInstallments.length === 0) {
      throw new BadRequestException('Não há parcelas em aberto nessa fatura');
    }

    const total = openInstallments.reduce((acc, i) => acc + Number(i.amount), 0);
    const paidAt = dto.date ? new Date(dto.date) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: dto.accountId },
        data: { currentBalance: { decrement: total } },
      });

      await tx.transaction.updateMany({
        where: { id: { in: openInstallments.map((i) => i.transactionId) } },
        data: { status: 'PAID' },
      });

      await tx.installment.updateMany({
        where: { id: { in: openInstallments.map((i) => i.id) } },
        data: { paid: true, paidFromAccountId: dto.accountId, paidAt },
      });
    });

    return { paidCount: openInstallments.length, totalPaid: total };
  }
/**
   * Exclui TODAS as parcelas de uma compra (mesmo installmentGroupId),
   * de uma vez só, e devolve o valor total pro limite disponível do cartão.
   */
  async deletePurchase(installmentGroupId: string, userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { installmentGroupId, userId },
      include: { installments: true },
    });
    if (transactions.length === 0) throw new NotFoundException('Compra não encontrada');

    const cardId = transactions[0].cardId!;
    const totalAmount = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const refunds = this.collectPaidRefunds(transactions);

    await this.prisma.$transaction(async (tx) => {
      // Parcelas já pagas: devolve o valor pra conta de onde saiu antes de excluir
      for (const [accountId, amount] of refunds) {
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: amount } } });
      }

      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });
      await tx.card.update({
        where: { id: cardId },
        data: { usedLimit: { decrement: totalAmount } },
      });
    });

    return { deleted: transactions.length };
  }

  /**
   * Soma, por conta, quanto precisa ser devolvido por conta das parcelas já
   * pagas de um conjunto de transações que estão prestes a ser apagadas.
   */
  private collectPaidRefunds(
    transactions: { installments: { paid: boolean; paidFromAccountId: string | null; amount: any }[] }[],
  ) {
    const refunds = new Map<string, number>();
    for (const t of transactions) {
      const installment = t.installments[0];
      if (installment?.paid && installment.paidFromAccountId) {
        refunds.set(
          installment.paidFromAccountId,
          (refunds.get(installment.paidFromAccountId) ?? 0) + Number(installment.amount),
        );
      }
    }
    return refunds;
  }

  /**
   * Edita uma compra parcelada inteira: apaga todas as parcelas antigas e
   * recria com os novos dados (mais simples e seguro do que tentar ajustar
   * parcela por parcela quando o número de parcelas pode até mudar).
   */
  async updatePurchase(installmentGroupId: string, userId: string, dto: CreatePurchaseDto) {
    const existing = await this.prisma.transaction.findMany({
      where: { installmentGroupId, userId },
      include: { installments: true },
    });
    if (existing.length === 0) throw new NotFoundException('Compra não encontrada');

    const cardId = existing[0].cardId!;
    const oldTotal = existing.reduce((acc, t) => acc + Number(t.amount), 0);
    const refunds = this.collectPaidRefunds(existing);

    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');

    const availableLimit = Number(card.limitAmount) - Number(card.usedLimit) + oldTotal;
    if (dto.totalAmount > availableLimit) {
      throw new BadRequestException(
        `Limite insuficiente. Disponível: R$ ${availableLimit.toFixed(2)}, compra: R$ ${dto.totalAmount.toFixed(2)}`,
      );
    }

    const installmentAmounts = this.splitAmount(dto.totalAmount, dto.installmentsCount);
    const purchaseDate = new Date(dto.purchaseDate);
    const newGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // Parcelas já pagas: devolve o valor pra conta de onde saiu — a compra
      // editada recria todas as parcelas em aberto do zero.
      for (const [accountId, amount] of refunds) {
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: amount } } });
      }

      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });

      for (let i = 0; i < dto.installmentsCount; i++) {
        const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.dueDay, i);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            cardId,
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            status: 'PENDING',
            description: `${dto.description} (${i + 1}/${dto.installmentsCount})`,
            amount: installmentAmounts[i],
            date: dueDate,
            isInstallment: true,
            installmentGroupId: newGroupId,
          },
        });

        await tx.installment.create({
          data: {
            transactionId: transaction.id,
            number: i + 1,
            totalCount: dto.installmentsCount,
            amount: installmentAmounts[i],
            dueDate,
            paid: false,
          },
        });
      }

      await tx.card.update({
        where: { id: cardId },
        data: { usedLimit: { increment: dto.totalAmount - oldTotal } },
      });

      return { installmentGroupId: newGroupId };
    });
  }
  private splitAmount(total: number, count: number): number[] {
    const base = Math.floor((total / count) * 100) / 100;
    const amounts = Array(count).fill(base);
    const diff = Math.round((total - base * count) * 100) / 100;
    amounts[count - 1] = Math.round((amounts[count - 1] + diff) * 100) / 100;
    return amounts;
  }

  /**
   * Calcula em qual fatura (mês) cada parcela vai cair: a primeira parcela
   * sempre cai no mês seguinte ao da compra (ex: compra em 14/08 → 1ª
   * parcela vence em 10/09), e cada parcela seguinte cai um mês depois.
   */
  private calculateInstallmentDueDate(purchaseDate: Date, dueDay: number, installmentIndex: number): Date {
    const invoiceMonth = purchaseDate.getMonth() + 1;
    const invoiceYear = purchaseDate.getFullYear();

    const targetMonth = invoiceMonth + installmentIndex;
    return new Date(invoiceYear, targetMonth, dueDay);
  }

  private async assertOwnership(id: string, userId: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
  }
}