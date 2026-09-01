import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateInstallmentPurchaseDto } from './dto/create-installment-purchase.dto';

/**
 * Compras/financiamentos parcelados fora do cartão (ex: boleto do carro,
 * consórcio, financiamento de imóvel) — reaproveita a mesma estrutura de
 * Transaction + Installment já usada pelas compras de cartão (ver
 * CardsService.createPurchase), só que sem cardId e sem limite de crédito:
 * cada parcela é uma Transaction EXPENSE própria (cardId null), com uma
 * Installment associada que controla se já foi paga e de qual conta saiu.
 */
@Injectable()
export class InstallmentPurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateInstallmentPurchaseDto) {
    const startInstallment = dto.startInstallment ?? 1;
    if (startInstallment > dto.totalInstallments) {
      throw new BadRequestException('A parcela inicial não pode ser maior que o total de parcelas');
    }

    if (dto.categoryId) await this.ensureCategoryOwnership(dto.categoryId, userId);
    if (dto.accountId) await this.ensureAccountOwnership(dto.accountId, userId);

    const firstDueDate = this.parseDateOnly(dto.firstDueDate);
    const installmentGroupId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const createdTransactions = [];

      for (let number = startInstallment; number <= dto.totalInstallments; number++) {
        const offset = number - startInstallment;
        const dueDate = this.addMonths(firstDueDate, offset);

        const transaction = await tx.transaction.create({
          data: {
            userId,
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            type: 'EXPENSE',
            status: 'PENDING',
            description: `${dto.description} (${number}/${dto.totalInstallments})`,
            amount: dto.installmentAmount,
            date: dueDate,
            isInstallment: true,
            installmentGroupId,
          },
        });

        await tx.installment.create({
          data: {
            transactionId: transaction.id,
            number,
            totalCount: dto.totalInstallments,
            amount: dto.installmentAmount,
            dueDate,
            paid: false,
          },
        });

        createdTransactions.push(transaction);
      }

      return { installmentGroupId, transactions: createdTransactions };
    });
  }

  /**
   * Lista todos os parcelamentos do usuário, agrupados por installmentGroupId
   * — cada grupo com a descrição, progresso (pagas/total) e a lista de
   * parcelas.
   */
  async findAll(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, isInstallment: true, cardId: null, installmentGroupId: { not: null } },
      include: {
        category: { select: { name: true, color: true } },
        account: { select: { name: true } },
        installments: {
          select: { id: true, number: true, totalCount: true, amount: true, dueDate: true, paid: true, paidAt: true },
        },
      },
      orderBy: [{ date: 'asc' }],
    });

    const groups = new Map<string, any>();
    transactions.forEach((t) => {
      const groupId = t.installmentGroupId!;
      const installment = t.installments[0];
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          installmentGroupId: groupId,
          description: t.description.replace(/\s\(\d+\/\d+\)$/, ''),
          category: t.category,
          categoryId: t.categoryId,
          account: t.account,
          accountId: t.accountId,
          totalCount: installment?.totalCount ?? 0,
          installmentAmount: Number(t.amount),
          items: [],
        });
      }
      groups.get(groupId).items.push({
        transactionId: t.id,
        installmentId: installment?.id ?? null,
        number: installment?.number ?? null,
        amount: Number(t.amount),
        dueDate: t.date,
        paid: installment?.paid ?? false,
        paidAt: installment?.paidAt ?? null,
      });
    });

    return Array.from(groups.values()).map((g) => {
      const paidCount = g.items.filter((i: any) => i.paid).length;
      const nextOpen = g.items.find((i: any) => !i.paid) ?? null;
      return {
        ...g,
        paidCount,
        remainingCount: g.items.length - paidCount,
        nextDueDate: nextOpen?.dueDate ?? null,
      };
    });
  }

  /**
   * Exclui todas as parcelas em aberto e já pagas de um parcelamento.
   * Parcelas já pagas têm o valor devolvido pra conta de onde saiu, já que a
   * exclusão remove o registro por completo (não é só "pausar").
   */
  async remove(installmentGroupId: string, userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { installmentGroupId, userId, cardId: null },
      include: { installments: true },
    });
    if (transactions.length === 0) throw new NotFoundException('Parcelamento não encontrado');

    const refunds = new Map<string, number>();
    transactions.forEach((t) => {
      const installment = t.installments[0];
      if (installment?.paid && installment.paidFromAccountId) {
        refunds.set(
          installment.paidFromAccountId,
          (refunds.get(installment.paidFromAccountId) ?? 0) + Number(installment.amount),
        );
      }
    });

    await this.prisma.$transaction(async (tx) => {
      for (const [accountId, amount] of refunds) {
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: amount } } });
      }
      await tx.transaction.deleteMany({ where: { installmentGroupId, userId } });
    });

    return { deleted: transactions.length };
  }

  // Pagar/desfazer pagamento de uma parcela reaproveita o endpoint já
  // genérico do módulo de cartões (CardsService.payInstallment/unpayInstallment
  // não têm nenhuma dependência de cardId — o Dashboard já usa exatamente o
  // mesmo endpoint pra pagar parcelas de card e de fora do card).

  private async ensureCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new ForbiddenException('Categoria não encontrada ou não pertence ao usuário');
  }

  private async ensureAccountOwnership(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new ForbiddenException('Conta não encontrada ou não pertence ao usuário');
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  }

  /**
   * Converte um "YYYY-MM-DD" pro dia local certo (ver mesma função em
   * CardsService — new Date('YYYY-MM-DD') é UTC e troca o dia em fusos
   * negativos).
   */
  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date(value);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
}
