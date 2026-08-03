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
        },
      });

      return transfer;
    });
  }

  getTotalBalance(userId: string) {
    return this.prisma.account.aggregate({
      where: { userId, isArchived: false },
      _sum: { currentBalance: true },
    });
  }
}