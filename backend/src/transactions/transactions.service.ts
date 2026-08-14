import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../common/prisma/prisma.service';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      search?: string;
      categoryId?: string;
      // 'INVESTMENT' não existe como TransactionType — é uma TRANSFER cuja
      // conta de destino é do tipo INVESTMENT. 'TRANSFER' aqui significa
      // "transferência que não é investimento", pra bater com o que o
      // formulário do frontend trata como tipos distintos (uiType).
      type?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT';
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.TransactionWhereInput = { userId };

    if (filters?.startDate || filters?.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
        ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.type === 'INVESTMENT') {
      where.type = 'TRANSFER';
      where.transfer = { toAccount: { type: 'INVESTMENT' } };
    } else if (filters?.type === 'TRANSFER') {
      where.type = 'TRANSFER';
      where.NOT = { transfer: { toAccount: { type: 'INVESTMENT' } } };
    } else if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { category: { name: { contains: filters.search, mode: 'insensitive' } } },
        { account: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

    const include = {
      account: { select: { name: true } },
      category: { select: { name: true, color: true } },
      transfer: {
        select: {
          id: true,
          toId: true,
          toAccount: { select: { name: true, type: true } },
        },
      },
    } satisfies Prisma.TransactionInclude;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async create(userId: string, data: CreateTransactionDto) {
    await this.ensureAccountOwnership(data.accountId, userId);
    if (data.categoryId) await this.ensureCategoryOwnership(data.categoryId, userId);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          ...data,
          userId,
          date: new Date(data.date),
        },
      });

      // Só INCOME/EXPENSE pagos afetam o saldo da conta aqui.
      // Transferências (TRANSFER) são tratadas exclusivamente pelo AccountsModule.
      if (transaction.status === 'PAID') {
        await this.applyBalanceEffect(tx, transaction.accountId, transaction.type, Number(transaction.amount), 1);
      }

      return transaction;
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    if (dto.accountId) await this.ensureAccountOwnership(dto.accountId, userId);
    if (dto.categoryId) await this.ensureCategoryOwnership(dto.categoryId, userId);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Transação não encontrada');
      if (existing.type === 'TRANSFER') {
        throw new ForbiddenException('Transferências não podem ser editadas por aqui');
      }

      // Reverte o efeito no saldo da transação como estava antes de editar
      if (existing.status === 'PAID') {
        await this.applyBalanceEffect(tx, existing.accountId, existing.type, Number(existing.amount), -1);
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          ...dto,
          date: dto.date ? new Date(dto.date) : undefined,
        },
      });

      // Reaplica o efeito com os valores novos
      if (updated.status === 'PAID') {
        await this.applyBalanceEffect(tx, updated.accountId, updated.type, Number(updated.amount), 1);
      }

      return updated;
    });
  }

  async remove(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Transação não encontrada');
      if (existing.type === 'TRANSFER') {
        throw new ForbiddenException(
          'Transferências não podem ser excluídas por aqui (exclua pela conta de origem/destino)',
        );
      }

      // Reverte o efeito no saldo antes de apagar
      if (existing.status === 'PAID') {
        await this.applyBalanceEffect(tx, existing.accountId, existing.type, Number(existing.amount), -1);
      }

      await tx.transaction.delete({ where: { id } });
      return { id };
    });
  }

  /**
   * Aplica (direction = 1) ou reverte (direction = -1) o impacto de uma
   * transação INCOME/EXPENSE no saldo da conta.
   */
  private async applyBalanceEffect(
    tx: TxClient,
    accountId: string | null | undefined,
    type: TransactionType,
    amount: number,
    direction: 1 | -1,
  ) {
    // Compras de cartão não têm conta vinculada (só cartão) — nada a fazer aqui
    if (!accountId) return;

    if (type === 'INCOME') {
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { increment: amount * direction } },
      });
    } else if (type === 'EXPENSE') {
      await tx.account.update({
        where: { id: accountId },
        data: { currentBalance: { decrement: amount * direction } },
      });
    }
    // TRANSFER não é tratado aqui — ver AccountsRepository.createTransfer
  }

  private async ensureAccountOwnership(accountId: string, userId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new ForbiddenException('Conta não encontrada ou não pertence ao usuário');
  }

  private async ensureCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new ForbiddenException('Categoria não encontrada ou não pertence ao usuário');
  }
}
