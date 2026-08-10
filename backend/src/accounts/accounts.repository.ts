import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * Repository Pattern: isola todo acesso a dados (Prisma) do restante da aplicação.
 * O Service nunca fala diretamente com o PrismaClient, apenas com este repositório.
 */
@Injectable()
export class AccountsRepository {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        initialBalance: dto.initialBalance ?? 0,
        currentBalance: dto.initialBalance ?? 0,
        color: dto.color,
        icon: dto.icon,
        includeInDashboard: dto.includeInDashboard ?? true,
      },
    });
  }

  async findManyPaginated(params: {
    userId: string;
    skip: number;
    take: number;
    search?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const { userId, skip, take, search, sortBy, sortOrder } = params;

    const where: Prisma.AccountWhereInput = {
      userId,
      isArchived: false,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.account.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string, userId: string) {
    return this.prisma.account.findFirst({ where: { id, userId } });
  }

  update(id: string, dto: UpdateAccountDto) {
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  archive(id: string) {
    return this.prisma.account.update({ where: { id }, data: { isArchived: true } });
  }

  adjustBalance(id: string, amount: Prisma.Decimal | number) {
    return this.prisma.account.update({
      where: { id },
      data: { currentBalance: { increment: amount } },
    });
  }

  // AQUI OCORRE A MÁGICA: Adicionamos o userId para a Transação Visual
  createTransfer(params: {
    userId: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
  }) {
    const { userId, fromAccountId, toAccountId, amount, description } = params;

    // Transação atômica: debita, credita, registra o transfer E a transaction visual numa única operação
    return this.prisma.$transaction(async (tx) => {
      // 1. Debita da conta de origem
      await tx.account.update({
        where: { id: fromAccountId },
        data: { currentBalance: { decrement: amount } },
      });

      // 2. Credita na conta de destino
      await tx.account.update({
        where: { id: toAccountId },
        data: { currentBalance: { increment: amount } },
      });

      // 3. Registra a transferência na tabela interna `transfers`
      const transfer = await tx.transfer.create({
        data: { fromId: fromAccountId, toId: toAccountId, amount, description },
      });

      // 4. Cria a transação visual para a tela e dashboard (vinculada à conta de origem)
      await tx.transaction.create({
        data: {
          userId,
          accountId: fromAccountId,
          type: 'TRANSFER',
          description: description || 'Transferência entre contas',
          amount,
          status: 'PAID',
          date: new Date(),
          transferId: transfer.id,
        },
      });

      return transfer;
    });
  }

  findTransferById(id: string) {
    return this.prisma.transfer.findUnique({
      where: { id },
      include: { fromAccount: true, toAccount: true },
    });
  }

  /**
   * Edita uma transferência (ou aporte de investimento) já existente,
   * revertendo o efeito antigo nas duas contas e aplicando o novo —
   * mesmo que a conta de origem/destino tenha mudado.
   */
  updateTransfer(params: {
    id: string;
    oldFromId: string;
    oldToId: string;
    oldAmount: number;
    newFromId: string;
    newToId: string;
    newAmount: number;
    description?: string;
    date?: Date;
  }) {
    const { id, oldFromId, oldToId, oldAmount, newFromId, newToId, newAmount, description, date } = params;

    return this.prisma.$transaction(async (tx) => {
      // 1. Reverte o efeito antigo
      await tx.account.update({ where: { id: oldFromId }, data: { currentBalance: { increment: oldAmount } } });
      await tx.account.update({ where: { id: oldToId }, data: { currentBalance: { decrement: oldAmount } } });

      // 2. Aplica o efeito novo (pode ser em contas diferentes)
      await tx.account.update({ where: { id: newFromId }, data: { currentBalance: { decrement: newAmount } } });
      await tx.account.update({ where: { id: newToId }, data: { currentBalance: { increment: newAmount } } });

      // 3. Atualiza o registro da transferência
      const updatedTransfer = await tx.transfer.update({
        where: { id },
        data: { fromId: newFromId, toId: newToId, amount: newAmount, description, date },
      });

      // 4. Atualiza a transação visual vinculada (se existir)
      await tx.transaction.updateMany({
        where: { transferId: id },
        data: {
          accountId: newFromId,
          amount: newAmount,
          description: description || 'Transferência entre contas',
          date: date ?? undefined,
        },
      });

      return updatedTransfer;
    });
  }

  /**
   * Exclui uma transferência: reverte o saldo nas duas contas e apaga o
   * registro (a transação visual vinculada é apagada em cascata).
   */
  deleteTransfer(params: { id: string; fromId: string; toId: string; amount: number }) {
    const { id, fromId, toId, amount } = params;

    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: fromId }, data: { currentBalance: { increment: amount } } });
      await tx.account.update({ where: { id: toId }, data: { currentBalance: { decrement: amount } } });
      await tx.transfer.delete({ where: { id } });
    });
  }

  getTotalBalance(userId: string) {
    return this.prisma.account.aggregate({
      where: { userId, isArchived: false },
      _sum: { currentBalance: true },
    });
  }
}