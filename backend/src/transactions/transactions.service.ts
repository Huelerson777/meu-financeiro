import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CATEGORY_KEYWORDS, normalize } from './category-keywords';
import { ImportPreviewDto, ImportTransactionsDto } from './dto/import-transactions.dto';

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
      status?: TransactionStatus;
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
      const dateRange = {
        ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}),
        ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}),
      };
      // Compras de cartão guardam em `date` o vencimento da parcela na
      // fatura, não quando o dinheiro saiu da conta — dá pra pagar uma
      // parcela antes da fatura fechar. Uma vez paga, ela conta pro período
      // pela data real do pagamento (installment.paidAt).
      andConditions.push({
        OR: [
          { cardId: null, date: dateRange },
          { cardId: { not: null }, installments: { some: { paid: true, paidAt: dateRange } } },
        ],
      });
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.status) {
      where.status = filters.status;
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
      // Parcelas (cartão ou financiamento) guardam o "pago" aqui, não em transaction.status
      installments: { select: { number: true, totalCount: true, paid: true, paidAt: true } },
      transfer: {
        select: {
          id: true,
          toId: true,
          toAccount: { select: { name: true, type: true } },
        },
      },
    } satisfies Prisma.TransactionInclude;

    const total = await this.prisma.transaction.count({ where });

    // Ordem pela data em que a coisa de fato aconteceu: parcelas pagas contam pela data do pagamento
    // (installment.paidAt), não pelo vencimento. O Prisma não ordena por esse COALESCE, então, até um
    // volume razoável, ordenamos só (id, data) em memória e buscamos os itens completos da página.
    // Acima disso cai para a ordem por data do lançamento, que é barata no banco.
    const MAX_IN_MEMORY_SORT = 5000;
    let items;
    if (total > 0 && total <= MAX_IN_MEMORY_SORT) {
      const light = await this.prisma.transaction.findMany({
        where,
        select: { id: true, date: true, installments: { select: { paid: true, paidAt: true } } },
      });
      const effective = (t: (typeof light)[number]) => {
        const paidAt = t.installments
          .filter((i) => i.paid && i.paidAt)
          .map((i) => i.paidAt!.getTime())
          .sort((a, b) => b - a)[0];
        return paidAt ?? t.date.getTime();
      };
      const pageIds = light
        .sort((a, b) => effective(b) - effective(a) || (a.id < b.id ? -1 : 1))
        .slice((page - 1) * limit, page * limit)
        .map((t) => t.id);

      const rows = await this.prisma.transaction.findMany({ where: { id: { in: pageIds } }, include });
      const byId = new Map(rows.map((r) => [r.id, r]));
      items = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    } else {
      items = await this.prisma.transaction.findMany({
        where,
        include,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }

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


  /**
   * Prévia de importação de extrato: para cada linha devolve a categoria sugerida (mesma lógica de
   * suggestCategory, mas carregando o histórico uma única vez) e se parece duplicada de algo que já
   * existe na conta (mesma data, valor e sentido). Duplicatas dentro do próprio arquivo contam
   * contra o que já existe: 2 linhas iguais no arquivo e 1 no banco marcam só a primeira.
   */
  async previewImport(userId: string, dto: ImportPreviewDto) {
    await this.ensureAccountOwnership(dto.accountId, userId);

    const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
    const dates = dto.rows.map((r) => new Date(r.date).getTime());
    const from = new Date(Math.min(...dates) - 24 * 3600 * 1000);
    const to = new Date(Math.max(...dates) + 24 * 3600 * 1000);

    const existing = await this.prisma.transaction.findMany({
      where: { userId, accountId: dto.accountId, type: { in: ['INCOME', 'EXPENSE'] }, date: { gte: from, lte: to } },
      select: { date: true, amount: true, type: true },
    });
    const pool = new Map<string, number>();
    existing.forEach((t) => {
      const key = `${dayKey(t.date)}|${t.type}|${Number(t.amount).toFixed(2)}`;
      pool.set(key, (pool.get(key) ?? 0) + 1);
    });

    const suggest = await this.buildCategorySuggester(userId);

    return dto.rows.map((row) => {
      const type = row.amount >= 0 ? 'INCOME' : 'EXPENSE';
      const key = `${dayKey(row.date)}|${type}|${Math.abs(row.amount).toFixed(2)}`;
      const left = pool.get(key) ?? 0;
      const duplicate = left > 0;
      if (duplicate) pool.set(key, left - 1);

      const suggestion = suggest(row.description);
      return { duplicate, categoryId: suggestion?.id ?? null, categoryName: suggestion?.name ?? null };
    });
  }

  /** Grava as linhas escolhidas como transações pagas e ajusta o saldo da conta, tudo ou nada. */
  async importTransactions(userId: string, dto: ImportTransactionsDto) {
    await this.ensureAccountOwnership(dto.accountId, userId);

    const categoryIds = [...new Set(dto.rows.map((r) => r.categoryId).filter(Boolean))] as string[];
    if (categoryIds.length > 0) {
      const owned = await this.prisma.category.count({ where: { id: { in: categoryIds }, userId } });
      if (owned !== categoryIds.length) throw new ForbiddenException('Categoria não encontrada ou não pertence ao usuário');
    }

    return this.prisma.$transaction(
      async (tx) => {
        let created = 0;
        for (const row of dto.rows) {
          const transaction = await tx.transaction.create({
            data: {
              userId,
              accountId: dto.accountId,
              categoryId: row.categoryId,
              type: row.type,
              description: row.description.trim(),
              amount: row.amount,
              status: 'PAID',
              date: new Date(row.date),
            },
          });
          await this.applyBalanceEffect(tx, dto.accountId, transaction.type, Number(transaction.amount), 1);
          created++;
        }
        return { created };
      },
      { timeout: 60_000 },
    );
  }

  /** Mesmo critério de suggestCategory (histórico do usuário, depois palavras-chave), com tudo carregado uma vez. */
  private async buildCategorySuggester(userId: string) {
    const [history, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, categoryId: { not: null }, type: { in: ['INCOME', 'EXPENSE'] } },
        select: { description: true, categoryId: true },
        orderBy: { date: 'desc' },
        take: 1000,
      }),
      this.prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const byName = new Map(categories.map((c) => [c.name, c]));
    const normalizedHistory = history.map((h) => ({ desc: normalize(h.description), categoryId: h.categoryId! }));

    return (description: string): { id: string; name: string } | null => {
      const query = normalize(description);
      if (!query) return null;

      const score = new Map<string, number>();
      const queryWords = new Set(query.split(/\s+/).filter((w) => w.length > 2));
      for (const h of normalizedHistory) {
        if (!h.desc) continue;
        let points = 0;
        if (h.desc === query) points = 100;
        else if (h.desc.includes(query) || query.includes(h.desc)) points = 60;
        else points = h.desc.split(/\s+/).filter((w) => w.length > 2 && queryWords.has(w)).length * 20;
        if (points > 0) score.set(h.categoryId, (score.get(h.categoryId) ?? 0) + points);
      }
      if (score.size > 0) {
        const [best] = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
        const found = byId.get(best);
        if (found) return found;
      }

      for (const [keyword, categoryName] of Object.entries(CATEGORY_KEYWORDS)) {
        if (query.includes(normalize(keyword))) {
          const found = byName.get(categoryName);
          if (found) return found;
        }
      }
      return null;
    };
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
