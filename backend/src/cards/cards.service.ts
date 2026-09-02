import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PayInstallmentDto } from './dto/pay-installment.dto';
import { PayInstallmentsBatchDto } from './dto/pay-installments-batch.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { CreateCreditDto } from './dto/create-credit.dto';
import { CreateRecurringPurchaseDto } from './dto/create-recurring-purchase.dto';
import { UpdateRecurringPurchaseDto } from './dto/update-recurring-purchase.dto';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista os cartões já com o valor em aberto da próxima fatura de cada um
   * (evita uma chamada extra por cartão só pra mostrar isso na listagem).
   * A 1ª parcela de uma compra cai na fatura do ciclo em que ela foi feita
   * (ver calculateInstallmentDueDate), que quase sempre já não é mais a
   * fatura do mês corrente — o que interessa é a fatura mais próxima que
   * ainda tem saldo em aberto (a próxima que o usuário precisa pagar), não
   * literalmente o mês do calendário atual.
   */
  async findAll(userId: string) {
    const cards = await this.prisma.card.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: 'asc' },
    });
    if (cards.length === 0) return cards;

    const openInstallments = await this.prisma.installment.findMany({
      where: { paid: false, transaction: { userId, cardId: { in: cards.map((c) => c.id) } } },
      select: { amount: true, dueDate: true, transaction: { select: { cardId: true } } },
    });

    // Créditos/estornos (transações sem parcela, valor negativo) também abatem
    // o saldo em aberto da fatura do mês em que caem.
    const credits = await this.prisma.transaction.findMany({
      where: { userId, cardId: { in: cards.map((c) => c.id) }, isInstallment: false, amount: { lt: 0 } },
      select: { amount: true, date: true, cardId: true },
    });

    // Por cartão, soma o saldo em aberto agrupado por mês de vencimento
    const byCard = new Map<string, Map<string, number>>();
    openInstallments.forEach((i) => {
      const cardId = i.transaction.cardId!;
      const monthKey = `${i.dueDate.getFullYear()}-${String(i.dueDate.getMonth() + 1).padStart(2, '0')}`;
      const monthMap = byCard.get(cardId) ?? new Map<string, number>();
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Number(i.amount));
      byCard.set(cardId, monthMap);
    });
    credits.forEach((c) => {
      const cardId = c.cardId!;
      const monthKey = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, '0')}`;
      const monthMap = byCard.get(cardId) ?? new Map<string, number>();
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + Number(c.amount));
      byCard.set(cardId, monthMap);
    });

    return cards.map((c) => {
      const monthMap = byCard.get(c.id);
      const earliestMonth = monthMap && monthMap.size > 0 ? Array.from(monthMap.keys()).sort()[0] : null;
      return {
        ...c,
        currentInvoiceOpenTotal: earliestMonth ? monthMap!.get(earliestMonth)! : 0,
      };
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
    const purchaseDate = this.parseDateOnly(dto.purchaseDate);
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
            status: 'PENDING', // vira PAID quando a parcela é efetivamente paga (ver payInstallment/payInvoice)
            description: `${dto.description} (${i + 1}/${dto.installmentsCount})`,
            amount: installmentAmounts[i],
            date: dueDate,
            purchaseDate,
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
   * Lança um crédito/estorno na fatura: uma transação avulsa (sem parcela)
   * de valor negativo, que abate diretamente o total e o saldo em aberto do
   * mês em que cai (definido por dto.date) — é assim que operadoras mostram
   * a devolução de uma compra cancelada. Libera limite de volta ao cartão,
   * já que a compra original tinha consumido esse limite.
   */
  async createCredit(cardId: string, userId: string, dto: CreateCreditDto) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
    if (card.isArchived) throw new BadRequestException('Este cartão está arquivado');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId,
          cardId,
          categoryId: dto.categoryId,
          type: 'EXPENSE',
          status: 'PAID',
          description: dto.description,
          amount: -Math.abs(dto.amount),
          date: this.parseDateOnly(dto.date),
          isInstallment: false,
        },
      });

      await tx.card.update({
        where: { id: cardId },
        data: { usedLimit: { decrement: dto.amount } },
      });

      return transaction;
    });
  }

  /**
   * Remove um crédito/estorno lançado na fatura, devolvendo o valor ao
   * limite usado do cartão (a compra original continua valendo).
   */
  async deleteCredit(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException('Crédito não encontrado');
    if (transaction.userId !== userId) throw new ForbiddenException('Este crédito não pertence a você');
    if (transaction.isInstallment || Number(transaction.amount) >= 0 || !transaction.cardId) {
      throw new BadRequestException('Esta transação não é um crédito de fatura');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } });
      await tx.card.update({
        where: { id: transaction.cardId! },
        data: { usedLimit: { increment: Math.abs(Number(transaction.amount)) } },
      });
    });

    return { deleted: true };
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
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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
        purchaseDate: t.purchaseDate,
        createdAt: t.createdAt,
        category: t.category,
        categoryId: t.categoryId,
        installmentGroupId: t.installmentGroupId,
        installmentId: installment?.id ?? null,
        paid,
        paidAt: installment?.paidAt ?? null,
        paidFromAccountName: installment?.paidFromAccount?.name ?? null,
        isCredit: !t.isInstallment && amount < 0,
        cardRecurringPurchaseId: t.cardRecurringPurchaseId,
      });
    });

    const invoices = Array.from(invoicesMap.values());

    // Dentro de cada fatura, ordena pela data real da compra (não pelo
    // vencimento, que é igual pra toda a fatura, nem pela ordem de
    // lançamento) — é isso que o agrupamento por dia no frontend espera.
    invoices.forEach((invoice) => {
      invoice.items.sort((a, b) => {
        const dateA = new Date(a.purchaseDate ?? (a.isCredit ? a.date : a.createdAt)).getTime();
        const dateB = new Date(b.purchaseDate ?? (b.isCredit ? b.date : b.createdAt)).getTime();
        return dateA - dateB;
      });
    });

    return invoices.sort((a, b) => (a.month < b.month ? -1 : 1));
  }

  /**
   * Cadastra uma compra recorrente (assinatura: Apple, streaming, mensalidade
   * de academia sem parcela definida...) e já gera a cobrança do ciclo atual,
   * pra aparecer na fatura imediatamente.
   */
  async createRecurringPurchase(cardId: string, userId: string, dto: CreateRecurringPurchaseDto) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
    if (card.isArchived) throw new BadRequestException('Este cartão está arquivado');

    const recurring = await this.prisma.cardRecurringPurchase.create({
      data: {
        userId,
        cardId,
        categoryId: dto.categoryId,
        description: dto.description,
        amount: dto.amount,
        chargeDay: dto.chargeDay,
        isActive: dto.isActive ?? true,
      },
    });

    await this.generateRecurringPurchaseOccurrence(recurring, card, new Date());

    return recurring;
  }

  async listRecurringPurchases(cardId: string, userId: string) {
    await this.assertOwnership(cardId, userId);
    return this.prisma.cardRecurringPurchase.findMany({
      where: { cardId, userId },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ isActive: 'desc' }, { description: 'asc' }],
    });
  }

  /**
   * Atualiza a definição da recorrência. Igual RecurringBillsService.update:
   * só reflete nas cobranças ainda em aberto (PENDING) — as já pagas ficam
   * como estavam, e ajusta o limite usado do cartão pela diferença de valor.
   */
  async updateRecurringPurchase(id: string, userId: string, dto: UpdateRecurringPurchaseDto) {
    const existing = await this.prisma.cardRecurringPurchase.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Compra recorrente não encontrada');

    const updated = await this.prisma.cardRecurringPurchase.update({
      where: { id },
      data: {
        description: dto.description,
        categoryId: dto.categoryId,
        amount: dto.amount,
        chargeDay: dto.chargeDay,
        isActive: dto.isActive,
      },
    });

    const pending = await this.prisma.transaction.findMany({
      where: { cardRecurringPurchaseId: id, status: 'PENDING' },
      select: { id: true, amount: true },
    });

    if (pending.length > 0) {
      await this.prisma.transaction.updateMany({
        where: { id: { in: pending.map((t) => t.id) } },
        data: {
          ...(dto.description != null ? { description: dto.description } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.amount != null ? { amount: dto.amount } : {}),
        },
      });

      if (dto.amount != null) {
        await this.prisma.installment.updateMany({
          where: { transactionId: { in: pending.map((t) => t.id) } },
          data: { amount: dto.amount },
        });

        const oldSum = pending.reduce((acc, t) => acc + Number(t.amount), 0);
        const newSum = dto.amount * pending.length;
        await this.prisma.card.update({
          where: { id: existing.cardId },
          data: { usedLimit: { increment: newSum - oldSum } },
        });
      }
    }

    return updated;
  }

  /**
   * Exclui definitivamente a definição da recorrência (pra de gerar cobranças
   * novas). As já geradas continuam existindo, só perdem o vínculo — mesma
   * lógica do RecurringBillsService.remove.
   */
  async removeRecurringPurchase(id: string, userId: string) {
    const existing = await this.prisma.cardRecurringPurchase.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Compra recorrente não encontrada');

    await this.prisma.cardRecurringPurchase.delete({ where: { id } });
    return { id };
  }

  /**
   * Gera, de forma idempotente, a cobrança (PENDING) do ciclo corrente pra
   * cada compra recorrente ativa do usuário que ainda não tem lançamento
   * nesse ciclo. Chamado pelo frontend ao abrir a fatura do cartão.
   */
  async syncRecurringPurchases(userId: string) {
    const now = new Date();
    const recurrences = await this.prisma.cardRecurringPurchase.findMany({
      where: { userId, isActive: true },
      include: { card: true },
    });

    let generated = 0;
    for (const recurring of recurrences) {
      if (recurring.card.isArchived) continue;
      const created = await this.generateRecurringPurchaseOccurrence(recurring, recurring.card, now);
      if (created) generated++;
    }

    return { generated };
  }

  /**
   * Cria a transação + parcela única (1/1) da cobrança recorrente pro mês de
   * `now`, se ainda não existir uma pra esse mês. purchaseDate cai no dia
   * configurado (chargeDay) e date (vencimento) é calculado exatamente como
   * numa compra normal, respeitando o ciclo de fechamento do cartão.
   */
  private async generateRecurringPurchaseOccurrence(
    recurring: {
      id: string;
      userId: string;
      cardId: string;
      categoryId: string | null;
      description: string;
      amount: any;
      chargeDay: number;
    },
    card: { closingDay: number; dueDay: number },
    now: Date,
  ): Promise<boolean> {
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const purchaseDate = new Date(now.getFullYear(), now.getMonth(), Math.min(recurring.chargeDay, lastDayOfMonth));

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const alreadyGenerated = await this.prisma.transaction.findFirst({
      where: { cardRecurringPurchaseId: recurring.id, purchaseDate: { gte: monthStart, lt: monthEnd } },
      select: { id: true },
    });
    if (alreadyGenerated) return false;

    const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.closingDay, card.dueDay, 0);
    const amount = Number(recurring.amount);

    await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: recurring.userId,
          cardId: recurring.cardId,
          categoryId: recurring.categoryId,
          type: 'EXPENSE',
          status: 'PENDING',
          description: recurring.description,
          amount,
          date: dueDate,
          purchaseDate,
          isInstallment: true,
          cardRecurringPurchaseId: recurring.id,
        },
      });

      await tx.installment.create({
        data: {
          transactionId: transaction.id,
          number: 1,
          totalCount: 1,
          amount,
          dueDate,
          paid: false,
        },
      });

      await tx.card.update({
        where: { id: recurring.cardId },
        data: { usedLimit: { increment: amount } },
      });
    });

    return true;
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
        data: { paid: true, paidFromAccountId: dto.accountId, paidAt: dto.date ? this.parseDateOnly(dto.date) : new Date() },
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
   * Paga de uma vez um conjunto de parcelas escolhidas pelo usuário (seleção
   * múltipla na fatura): mesma lógica do pagamento individual, mas em lote.
   */
  async payInstallmentsBatch(userId: string, dto: PayInstallmentsBatchDto) {
    const uniqueIds = Array.from(new Set(dto.installmentIds));

    const installments = await this.prisma.installment.findMany({
      where: { id: { in: uniqueIds } },
      include: { transaction: { select: { userId: true } } },
    });

    if (installments.length !== uniqueIds.length) {
      throw new NotFoundException('Uma ou mais parcelas não foram encontradas');
    }
    if (installments.some((i) => i.transaction.userId !== userId)) {
      throw new ForbiddenException('Uma ou mais parcelas não pertencem a você');
    }
    if (installments.some((i) => i.paid)) {
      throw new BadRequestException('Uma ou mais parcelas selecionadas já estão pagas');
    }

    const account = await this.prisma.account.findFirst({ where: { id: dto.accountId, userId } });
    if (!account) throw new NotFoundException('Conta não encontrada');

    const total = installments.reduce((acc, i) => acc + Number(i.amount), 0);
    const paidAt = dto.date ? this.parseDateOnly(dto.date) : new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: dto.accountId },
        data: { currentBalance: { decrement: total } },
      });

      await tx.transaction.updateMany({
        where: { id: { in: installments.map((i) => i.transactionId) } },
        data: { status: 'PAID' },
      });

      await tx.installment.updateMany({
        where: { id: { in: uniqueIds } },
        data: { paid: true, paidFromAccountId: dto.accountId, paidAt },
      });
    });

    return { paidCount: installments.length, totalPaid: total };
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
    const paidAt = dto.date ? this.parseDateOnly(dto.date) : new Date();

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
    const purchaseDate = this.parseDateOnly(dto.purchaseDate);
    const newGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      // Parcelas já pagas: devolve o valor pra conta de onde saiu — a compra
      // editada recria todas as parcelas em aberto do zero.
      for (const [accountId, amount] of refunds) {
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: amount } } });
      }

      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });

      for (let i = 0; i < dto.installmentsCount; i++) {
        const dueDate = this.calculateInstallmentDueDate(purchaseDate, card.closingDay, card.dueDay, i);

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
            purchaseDate,
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
   * Calcula em qual fatura (mês) cada parcela vai cair, respeitando o dia de
   * fechamento do cartão: uma compra feita até o dia de fechamento entra no
   * ciclo que fecha naquele mês; feita depois, só entra no ciclo seguinte.
   * O vencimento cai no mesmo mês do fechamento quando dueDay >= closingDay
   * (ex: fecha dia 3, vence dia 10), ou no mês seguinte quando dueDay <
   * closingDay (ex: fecha dia 27, vence dia 3). Cada parcela seguinte cai um
   * mês depois da anterior.
   */
  private calculateInstallmentDueDate(
    purchaseDate: Date,
    closingDay: number,
    dueDay: number,
    installmentIndex: number,
  ): Date {
    let cycleMonth = purchaseDate.getMonth();
    const cycleYear = purchaseDate.getFullYear();

    if (purchaseDate.getDate() > closingDay) {
      cycleMonth += 1;
    }

    let dueMonth = cycleMonth;
    if (dueDay < closingDay) {
      dueMonth += 1;
    }

    return new Date(cycleYear, dueMonth + installmentIndex, dueDay);
  }

  private async assertOwnership(id: string, userId: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Cartão não encontrado');
    if (card.userId !== userId) throw new ForbiddenException('Este cartão não pertence a você');
  }

  /**
   * Converte um "YYYY-MM-DD" (o formato que <input type="date"> manda) pro
   * dia local certo. `new Date('YYYY-MM-DD')` é interpretado como meia-noite
   * UTC — em fusos negativos (ex: Brasil, UTC-3) isso vira 21h do dia
   * anterior no horário local, o que troca o mês quando a data é dia 1º.
   */
  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date(value);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
}