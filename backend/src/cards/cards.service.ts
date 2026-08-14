import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

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
        const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.closingDay, card.dueDay, i);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            cardId,
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            status: 'PAID', // conta no total de despesas do mês da parcela
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
        installments: { select: { id: true, paid: true, dueDate: true } },
      },
      orderBy: { date: 'asc' },
    });

    const invoicesMap = new Map<string, { month: string; total: number; items: any[] }>();

    transactions.forEach((t) => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      if (!invoicesMap.has(key)) {
        invoicesMap.set(key, { month: key, total: 0, items: [] });
      }
      const invoice = invoicesMap.get(key)!;
      const installment = t.installments[0];
      invoice.total += Number(t.amount);
      invoice.items.push({
        id: t.id,
        description: t.description,
        amount: Number(t.amount),
        date: t.date,
        category: t.category,
        categoryId: t.categoryId,
        installmentGroupId: t.installmentGroupId,
        installmentId: installment?.id ?? null,
        paid: installment?.paid ?? false,
      });
    });

    return Array.from(invoicesMap.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
  }

  /**
   * Marca (ou desmarca) uma parcela individual como paga. Não afeta o limite
   * do cartão nem o saldo de conta — é só um controle de "já quitei essa
   * parcela", usado no painel de Pago x Em Aberto e nas notificações de
   * vencimento próximo.
   */
  async setInstallmentPaid(installmentId: string, userId: string, paid: boolean) {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: { transaction: { select: { userId: true } } },
    });
    if (!installment) throw new NotFoundException('Parcela não encontrada');
    if (installment.transaction.userId !== userId) {
      throw new ForbiddenException('Esta parcela não pertence a você');
    }

    return this.prisma.installment.update({
      where: { id: installmentId },
      data: { paid },
    });
  }
/**
   * Exclui TODAS as parcelas de uma compra (mesmo installmentGroupId),
   * de uma vez só, e devolve o valor total pro limite disponível do cartão.
   */
  async deletePurchase(installmentGroupId: string, userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { installmentGroupId, userId },
    });
    if (transactions.length === 0) throw new NotFoundException('Compra não encontrada');

    const cardId = transactions[0].cardId!;
    const totalAmount = transactions.reduce((acc, t) => acc + Number(t.amount), 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });
      await tx.card.update({
        where: { id: cardId },
        data: { usedLimit: { decrement: totalAmount } },
      });
    });

    return { deleted: transactions.length };
  }

  /**
   * Edita uma compra parcelada inteira: apaga todas as parcelas antigas e
   * recria com os novos dados (mais simples e seguro do que tentar ajustar
   * parcela por parcela quando o número de parcelas pode até mudar).
   */
  async updatePurchase(installmentGroupId: string, userId: string, dto: CreatePurchaseDto) {
    const existing = await this.prisma.transaction.findMany({
      where: { installmentGroupId, userId },
    });
    if (existing.length === 0) throw new NotFoundException('Compra não encontrada');

    const cardId = existing[0].cardId!;
    const oldTotal = existing.reduce((acc, t) => acc + Number(t.amount), 0);

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
      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });

      for (let i = 0; i < dto.installmentsCount; i++) {
        const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.closingDay, card.dueDay, i);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            cardId,
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            status: 'PAID',
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
   * Calcula em qual fatura (mês) cada parcela vai cair:
   * - Se a compra foi feita DEPOIS do dia de fechamento, ela só entra na
   *   fatura do mês seguinte.
   * - A partir daí, cada parcela seguinte cai um mês depois.
   */
  private calculateInstallmentDueDate(purchaseDate: Date, closingDay: number, dueDay: number, installmentIndex: number): Date {
    let invoiceMonth = purchaseDate.getMonth();
    let invoiceYear = purchaseDate.getFullYear();

    if (purchaseDate.getDate() > closingDay) {
      invoiceMonth += 1;
      if (invoiceMonth > 11) {
        invoiceMonth = 0;
        invoiceYear += 1;
      }
    }

    const targetMonth = invoiceMonth + installmentIndex;
    return new Date(invoiceYear, targetMonth, dueDay);
  }

  private async assertOwnership(id: string, userId: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
  }
}