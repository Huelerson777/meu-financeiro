import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { monthKey, pickRecurringMatch } from '../recurring-bills/recurring-match';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CATEGORY_KEYWORDS, meaningfulWords, normalize } from './category-keywords';
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

      // Parcela (compra no cartão ou parcelamento): valor, pagamento e conta
      // vivem na Installment e no limite do cartão, não aqui. Editar por esta
      // rota debitaria a conta de novo e deixaria parcela/limite fora de
      // sincronia — só descrição, categoria e observação podem mudar.
      if (existing.cardId || existing.isInstallment) {
        const changesMoney =
          (dto.amount !== undefined && Number(dto.amount) !== Number(existing.amount)) ||
          (dto.type !== undefined && dto.type !== existing.type) ||
          (dto.status !== undefined && dto.status !== existing.status);
        if (changesMoney) {
          throw new ForbiddenException(
            existing.cardId
              ? 'Compras no cartão têm valor e pagamento alterados pela fatura (Contas e Cartões). Aqui só dá pra mudar descrição e categoria.'
              : 'Parcelas têm valor e pagamento alterados em Recorrentes → Parcelamentos. Aqui só dá pra mudar descrição e categoria.',
          );
        }
        return tx.transaction.update({
          where: { id },
          data: { description: dto.description, categoryId: dto.categoryId, notes: dto.notes },
        });
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
      // Apagar só a Transaction de uma parcela não devolveria o limite do
      // cartão nem o que já foi debitado da conta no pagamento — a exclusão
      // certa (CardsService.deletePurchase / InstallmentPurchasesService.remove)
      // desfaz tudo junto.
      if (existing.cardId) {
        throw new ForbiddenException(
          'Compras no cartão são excluídas pela fatura do cartão (Contas e Cartões), para devolver o limite e o valor já pago.',
        );
      }
      if (existing.isInstallment) {
        throw new ForbiddenException('Parcelas são excluídas em Recorrentes → Parcelamentos, junto com o parcelamento.');
      }

      // Reverte o efeito no saldo antes de apagar
      if (existing.status === 'PAID') {
        await this.applyBalanceEffect(tx, existing.accountId, existing.type, Number(existing.amount), -1);
      }

      // Excluir o lançamento do mês de uma conta fixa significa "esse mês não tem": registra o mês
      // pulado, senão o sync de contas fixas recriaria o lançamento na próxima abertura do app.
      if (existing.recurringBillId && existing.status !== 'PAID') {
        const month = monthKey(existing.date);
        await tx.recurringBillSkip.upsert({
          where: { recurringBillId_month: { recurringBillId: existing.recurringBillId, month } },
          update: {},
          create: { recurringBillId: existing.recurringBillId, month },
        });
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

      const suggestion = suggest(row.description, type);
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

  /**
   * Importação vinda do Open Finance: ignora o que já foi importado (pelo `externalId`), grava como
   * pago e ajusta o saldo da conta. `amount` vem com sinal.
   *
   * Entra SEM categoria: a sugestão por histórico/palavra-chave errava demais aqui (ex: um Pix
   * qualquer caía em Mercado/Alimentação por parecer com uma compra antiga), e como a sincronização
   * roda sozinha ninguém revisa antes de gravar. O usuário categoriza depois ("Despesas sem
   * categoria" no Início). Conta fixa reconhecida continua com a categoria dela.
   */
  async importFromBank(
    userId: string,
    accountId: string,
    rows: { externalId: string; date: Date; description: string; amount: number }[],
  ) {
    await this.ensureAccountOwnership(accountId, userId);
    if (rows.length === 0) return { created: 0 };

    const known = await this.prisma.transaction.findMany({
      where: { userId, externalId: { in: rows.map((r) => r.externalId) } },
      select: { externalId: true },
    });
    const knownIds = new Set(known.map((k) => k.externalId));
    let fresh = rows.filter((r) => r.amount !== 0 && !knownIds.has(r.externalId));
    if (fresh.length === 0) return { created: 0 };

    // Pagar parcelas de cartão pelo app já debita a conta. O banco depois traz o mesmo pagamento da
    // fatura como saída: importá-lo descontaria a fatura duas vezes no saldo.
    fresh = await this.withoutCardPaymentsAlreadyBooked(userId, accountId, fresh);
    if (fresh.length === 0) return { created: 0, settledRecurring: 0 };

    // Contas fixas ainda em aberto na conta: se o banco mostra que foi pago, baixa a fixa (atualizando
    // o valor real, ex: energia que muda todo mês) em vez de criar um segundo lançamento.
    const open = (
      await this.prisma.transaction.findMany({
        where: {
          userId,
          recurringBillId: { not: null },
          status: { in: ['PENDING', 'OVERDUE'] },
          OR: [{ accountId }, { accountId: null }],
        },
        select: { id: true, description: true, amount: true, date: true, type: true },
      })
    ).map((t) => ({ ...t, amount: Number(t.amount) }));
    const taken = new Set<string>();

    return this.prisma.$transaction(
      async (tx) => {
        let settled = 0;
        for (const row of fresh) {
          const type: TransactionType = row.amount > 0 ? 'INCOME' : 'EXPENSE';
          const amount = Math.abs(row.amount);

          const match = pickRecurringMatch(
            { description: row.description, amount, type, date: row.date },
            open.filter((o) => !taken.has(o.id)),
          );
          if (match) {
            taken.add(match.id);
            await tx.transaction.update({
              where: { id: match.id },
              data: { status: 'PAID', amount, date: row.date, accountId, externalId: row.externalId },
            });
            await this.applyBalanceEffect(tx, accountId, type, amount, 1);
            settled++;
            continue;
          }

          await tx.transaction.create({
            data: {
              userId,
              accountId,
              categoryId: null,
              type,
              description: row.description.trim().slice(0, 200) || 'Sem descrição',
              amount,
              status: 'PAID',
              date: row.date,
              externalId: row.externalId,
            },
          });
          await this.applyBalanceEffect(tx, accountId, type, amount, 1);
        }
        return { created: fresh.length - settled, settledRecurring: settled };
      },
      { timeout: 60_000 },
    );
  }

  /**
   * Quem marcou a conta fixa como paga à mão ANTES de a sincronização do banco trazer o mesmo pagamento
   * fica com o gasto duas vezes (e o saldo da conta errado). Aqui funde cada par: mantém o lançamento do
   * banco (valor real), herda a conta fixa e a categoria do manual, e apaga o manual devolvendo o saldo.
   * Só funde com valor praticamente igual (±R$ 1) e na mesma conta; `apply: false` só lista.
   */
  async mergeManualRecurringWithBank(userId: string, opts: { accountId?: string; apply?: boolean } = {}) {
    const apply = opts.apply ?? true;
    const where = { userId, status: 'PAID' as const, type: { in: ['INCOME', 'EXPENSE'] as TransactionType[] }, ...(opts.accountId ? { accountId: opts.accountId } : {}) };
    const [bank, manual] = await Promise.all([
      this.prisma.transaction.findMany({ where: { ...where, externalId: { not: null }, recurringBillId: null }, orderBy: { date: 'asc' } }),
      this.prisma.transaction.findMany({ where: { ...where, externalId: null, recurringBillId: { not: null }, cardId: null } }),
    ]);

    const taken = new Set<string>();
    const merged: { bank: string; manual: string; description: string; amount: number }[] = [];
    for (const b of bank) {
      const candidates = manual
        .filter((m) => m.accountId === b.accountId && !taken.has(m.id) && Math.abs(Number(m.amount) - Number(b.amount)) <= 1)
        .map((m) => ({ ...m, amount: Number(m.amount) }));
      const match = pickRecurringMatch(
        { description: b.description, amount: Number(b.amount), type: b.type, date: b.date },
        // pickRecurringMatch olha o lançamento pendente à frente da data do banco; aqui o manual pode estar dos dois lados.
        candidates.map((c) => ({ ...c, date: new Date(Math.min(c.date.getTime(), b.date.getTime() + 15 * 86400000)) })),
      );
      if (!match) continue;
      taken.add(match.id);
      merged.push({ bank: b.id, manual: match.id, description: b.description, amount: Number(b.amount) });
      if (!apply) continue;

      const m = manual.find((x) => x.id === match.id)!;
      await this.prisma.$transaction(async (tx) => {
        await this.applyBalanceEffect(tx, m.accountId, m.type, Number(m.amount), -1);
        await tx.transaction.delete({ where: { id: m.id } });
        await tx.transaction.update({
          where: { id: b.id },
          data: { recurringBillId: m.recurringBillId, categoryId: m.categoryId ?? b.categoryId },
        });
      });
    }
    return { merged: merged.length, items: merged };
  }

  /**
   * Descarta saídas do banco que são o pagamento de parcelas de cartão já baixadas no app: o valor bate
   * com a soma das parcelas de um mesmo cartão pagas a partir desta conta, com até 3 dias de diferença.
   */
  private async withoutCardPaymentsAlreadyBooked<T extends { date: Date; amount: number }>(
    userId: string,
    accountId: string,
    rows: T[],
  ): Promise<T[]> {
    const outflows = rows.filter((r) => r.amount < 0);
    if (outflows.length === 0) return rows;
    const times = outflows.map((r) => r.date.getTime());
    const DAY = 86400000;
    const paid = await this.prisma.installment.findMany({
      where: {
        paid: true,
        paidFromAccountId: accountId,
        paidAt: { gte: new Date(Math.min(...times) - 4 * DAY), lte: new Date(Math.max(...times) + 4 * DAY) },
        transaction: { userId },
      },
      select: { amount: true, paidAt: true, transaction: { select: { cardId: true } } },
    });
    if (paid.length === 0) return rows;

    const groups = new Map<string, { cents: number; at: number }>();
    for (const i of paid) {
      if (!i.paidAt) continue;
      const day = i.paidAt.toISOString().slice(0, 10);
      const key = `${i.transaction.cardId}|${day}`;
      const g = groups.get(key) ?? { cents: 0, at: i.paidAt.getTime() };
      g.cents += Math.round(Number(i.amount) * 100);
      groups.set(key, g);
    }
    const booked = [...groups.values()];
    return rows.filter((r) => {
      if (r.amount >= 0) return true;
      const cents = Math.round(Math.abs(r.amount) * 100);
      return !booked.some((g) => g.cents === cents && Math.abs(g.at - r.date.getTime()) <= 3 * DAY);
    });
  }

  /** Mesmo critério de suggestCategory (histórico do usuário, depois palavras-chave), com tudo carregado uma vez. */
  private async buildCategorySuggester(userId: string) {
    const [history, categories] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, categoryId: { not: null }, type: { in: ['INCOME', 'EXPENSE'] } },
        select: { description: true, categoryId: true, type: true },
        orderBy: { date: 'desc' },
        take: 1000,
      }),
      this.prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const byName = new Map(categories.map((c) => [c.name, c]));
    const normalizedHistory = history.map((h) => ({
      desc: normalize(h.description),
      categoryId: h.categoryId!,
      type: h.type,
    }));

    return (description: string, type: 'INCOME' | 'EXPENSE' = 'EXPENSE'): { id: string; name: string } | null => {
      const query = normalize(description);
      if (!query) return null;

      const score = new Map<string, number>();
      const queryWords = new Set(meaningfulWords(query));
      for (const h of normalizedHistory) {
        // Entrada só aprende com entrada, saída com saída: um Pix recebido nunca herda a categoria de uma compra.
        if (!h.desc || h.type !== type) continue;
        let points = 0;
        if (h.desc === query) points = 100;
        else if (h.desc.includes(query) || query.includes(h.desc)) points = 60;
        else points = meaningfulWords(h.desc).filter((w) => queryWords.has(w)).length * 20;
        if (points > 0) score.set(h.categoryId, (score.get(h.categoryId) ?? 0) + points);
      }
      if (score.size > 0) {
        const [best] = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
        const found = byId.get(best);
        if (found) return found;
      }

      // As palavras-chave são todas de despesa; entrada fica sem categoria em vez de chutar.
      if (type === 'INCOME') return null;

      const queryTokens = new Set(query.split(/\s+/));
      for (const [keyword, categoryName] of Object.entries(CATEGORY_KEYWORDS)) {
        const k = normalize(keyword);
        // Palavra inteira: "bar" não deve casar com "Barbosa", nem "luz" com "Luzia".
        const hit = k.includes(' ') ? ` ${query} `.includes(` ${k} `) : queryTokens.has(k);
        if (hit) {
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
