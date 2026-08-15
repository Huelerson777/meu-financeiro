import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CATEGORY_KEYWORDS, normalize } from './category-keywords';

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
      // formulário do frontend trata como tipos distintos (uiType). Aceita
      // vários tipos ao mesmo tempo (ex: receitas + despesas).
      types?: ('INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT')[];
      amount?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const where: Prisma.TransactionWhereInput = { userId };
    // Duas buscas diferentes (tipo e descrição/conta/categoria) cada uma
    // combinando várias opções com OR — não dá pra usar where.OR duas vezes
    // (a segunda sobrescreveria a primeira), por isso cada uma vira um item
    // de where.AND.
    const andConditions: Prisma.TransactionWhereInput[] = [];

    if (filters?.startDate || filters?.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
        ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}),
      };
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.types && filters.types.length > 0) {
      andConditions.push({ OR: filters.types.map((t) => this.typeCondition(t)) });
    }

    if (filters?.search) {
      andConditions.push({
        OR: [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { category: { name: { contains: filters.search, mode: 'insensitive' } } },
          { account: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Busca por "contém" no valor (ex: "15" acha 15, 315, 1500...) — amount é
    // Decimal, então o Prisma não tem um filtro "contains" pronto pra ele;
    // resolve buscando os ids que batem via SQL bruto e filtrando por eles.
    if (filters?.amount) {
      const matches = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM transactions WHERE user_id = ${userId} AND amount::text LIKE ${'%' + filters.amount + '%'}
      `;
      where.id = { in: matches.map((m) => m.id) };
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

  /**
   * Sugere uma categoria pra descrição digitada, sem custo de API externa:
   * 1) procura no próprio histórico do usuário uma descrição parecida e usa
   *    a categoria mais usada nela; 2) se não achar nada, cai num dicionário
   *    de palavras-chave fixo (ver category-keywords.ts).
   */
  async suggestCategory(userId: string, description: string) {
    const empty = { categoryId: null, categoryName: null, source: null as null };
    const query = normalize(description);
    if (!query) return empty;

    const history = await this.prisma.transaction.findMany({
      where: { userId, categoryId: { not: null }, type: { in: ['INCOME', 'EXPENSE'] } },
      select: { description: true, categoryId: true },
      orderBy: { date: 'desc' },
      take: 500,
    });

    const scoreByCategory = new Map<string, number>();
    const queryWords = new Set(query.split(/\s+/).filter((w) => w.length > 2));

    for (const t of history) {
      const desc = normalize(t.description);
      if (!desc) continue;

      let score = 0;
      if (desc === query) score = 100;
      else if (desc.includes(query) || query.includes(desc)) score = 60;
      else {
        const overlap = desc.split(/\s+/).filter((w) => w.length > 2 && queryWords.has(w)).length;
        score = overlap * 20;
      }

      if (score > 0) {
        scoreByCategory.set(t.categoryId!, (scoreByCategory.get(t.categoryId!) ?? 0) + score);
      }
    }

    if (scoreByCategory.size > 0) {
      const [bestCategoryId] = [...scoreByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
      const category = await this.prisma.category.findUnique({ where: { id: bestCategoryId } });
      if (category) return { categoryId: category.id, categoryName: category.name, source: 'history' as const };
    }

    for (const [keyword, categoryName] of Object.entries(CATEGORY_KEYWORDS)) {
      if (query.includes(normalize(keyword))) {
        const category = await this.prisma.category.findFirst({ where: { userId, name: categoryName } });
        if (category) return { categoryId: category.id, categoryName: category.name, source: 'keyword' as const };
      }
    }

    return empty;
  }

  private typeCondition(type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT'): Prisma.TransactionWhereInput {
    if (type === 'INVESTMENT') return { type: 'TRANSFER', transfer: { toAccount: { type: 'INVESTMENT' } } };
    if (type === 'TRANSFER') return { type: 'TRANSFER', NOT: { transfer: { toAccount: { type: 'INVESTMENT' } } } };
    return { type };
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
