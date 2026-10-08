import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CardsService } from '../cards/cards.service';
import { toCardRows } from './card-import';
import { PluggyClient } from './pluggy.client';

const BRAZIL_UTC_OFFSET_MS = 3 * 3600 * 1000;

/**
 * A primeira sincronização começa hoje: o histórico anterior já foi lançado à mão e,
 * como a importação só deduplica por externalId, trazê-lo duplicaria os lançamentos e o saldo.
 */
function startOfTodayBrazil(): Date {
  const brazilNow = new Date(Date.now() - BRAZIL_UTC_OFFSET_MS);
  return new Date(Date.UTC(brazilNow.getUTCFullYear(), brazilNow.getUTCMonth(), brazilNow.getUTCDate()));
}

// Reprocessa uma janela antes da última sincronização: lançamentos pendentes no banco só aparecem depois.
const OVERLAP_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class OpenFinanceService {
  private readonly syncing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyClient,
    private readonly transactions: TransactionsService,
    private readonly cards: CardsService,
  ) {}

  list(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      include: { links: true, cardLinks: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, itemId: string, label: string) {
    const exists = await this.prisma.bankConnection.findUnique({ where: { userId_itemId: { userId, itemId } } });
    if (exists) throw new ConflictException('Esta conexão já foi adicionada');
    // Valida o itemId na Pluggy antes de guardar (falha se estiver errado ou sem acesso).
    await this.pluggy.listAccounts(itemId);
    return this.prisma.bankConnection.create({ data: { userId, itemId, label: label.trim() } });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.bankConnection.delete({ where: { id } });
  }

  /** Contas que a Pluggy enxerga nessa conexão, marcando a quais contas do PouPay já estão ligadas. */
  async remoteAccounts(userId: string, id: string) {
    const connection = await this.getOwned(userId, id);
    const accounts = await this.pluggy.listAccounts(connection.itemId);
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      number: a.number ?? null,
      balance: a.balance,
      supported: a.type === 'BANK' || a.type === 'CREDIT',
      linkedAccountId: connection.links.find((l) => l.pluggyAccountId === a.id)?.accountId ?? null,
      linkedCardId: connection.cardLinks.find((l) => l.pluggyAccountId === a.id)?.cardId ?? null,
    }));
  }

  async link(userId: string, id: string, pluggyAccountId: string, accountId: string) {
    await this.getOwned(userId, id);
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new ForbiddenException('Conta não encontrada ou não pertence ao usuário');

    return this.prisma.bankAccountLink.upsert({
      where: { connectionId_pluggyAccountId: { connectionId: id, pluggyAccountId } },
      update: { accountId },
      create: { connectionId: id, pluggyAccountId, accountId },
    });
  }

  async unlink(userId: string, id: string, pluggyAccountId: string) {
    await this.getOwned(userId, id);
    await this.prisma.bankAccountLink.deleteMany({ where: { connectionId: id, pluggyAccountId } });
  }

  async linkCard(userId: string, id: string, pluggyAccountId: string, cardId: string) {
    await this.getOwned(userId, id);
    const card = await this.prisma.card.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new ForbiddenException('Cartão não encontrado ou não pertence ao usuário');

    // Trocar o cartão de destino mantém o corte original; ligar de novo começa de hoje.
    return this.prisma.bankCardLink.upsert({
      where: { connectionId_pluggyAccountId: { connectionId: id, pluggyAccountId } },
      update: { cardId },
      create: { connectionId: id, pluggyAccountId, cardId, startsAt: startOfTodayBrazil() },
    });
  }

  async unlinkCard(userId: string, id: string, pluggyAccountId: string) {
    await this.getOwned(userId, id);
    await this.prisma.bankCardLink.deleteMany({ where: { connectionId: id, pluggyAccountId } });
  }

  /** Chamado pelo webhook da Pluggy: sincroniza toda conexão (de qualquer usuário) desse item. */
  async syncByItem(itemId: string) {
    const connections = await this.prisma.bankConnection.findMany({ where: { itemId }, select: { id: true, userId: true } });
    for (const connection of connections) {
      // Webhook repetido ou clique manual ao mesmo tempo: uma sincronização por conexão de cada vez.
      if (this.syncing.has(connection.id)) continue;
      this.syncing.add(connection.id);
      try {
        await this.sync(connection.userId, connection.id);
      } finally {
        this.syncing.delete(connection.id);
      }
    }
  }

  /** Traz as transações novas de cada conta ligada. Não mexe em contas sem ligação. */
  async sync(userId: string, id: string) {
    const connection = await this.getOwned(userId, id);
    const from = connection.lastSyncAt
      ? new Date(connection.lastSyncAt.getTime() - OVERLAP_DAYS * DAY_MS)
      : startOfTodayBrazil();
    const startedAt = new Date();

    let created = 0;
    for (const link of connection.links) {
      const remote = await this.pluggy.listTransactions(link.pluggyAccountId, from);
      const rows = remote
        .filter((t) => t.status !== 'PENDING')
        .map((t) => ({
          externalId: `pluggy:${t.id}`,
          date: new Date(t.date),
          description: t.description,
          // Pluggy: CREDIT entra dinheiro, DEBIT sai — independe do sinal que o banco mandou.
          amount: (t.type === 'CREDIT' ? 1 : -1) * Math.abs(t.amount),
        }));
      created += (await this.transactions.importFromBank(userId, link.accountId, rows)).created;
    }

    if (connection.cardLinks.length > 0) {
      const recurring = (
        await this.prisma.cardRecurringPurchase.findMany({
          where: { userId, isActive: true, cardId: { in: connection.cardLinks.map((l) => l.cardId) } },
          select: { cardId: true, description: true, amount: true },
        })
      ).map((r) => ({ cardId: r.cardId, description: r.description, amount: Number(r.amount) }));

      for (const link of connection.cardLinks) {
        const cardFrom = link.lastSyncAt ? new Date(link.lastSyncAt.getTime() - OVERLAP_DAYS * DAY_MS) : link.startsAt;
        const remote = await this.pluggy.listTransactions(link.pluggyAccountId, cardFrom);
        // Em cartão, compras da fatura aberta vêm como PENDING com id estável: precisam entrar.
        const rows = toCardRows(remote, recurring.filter((r) => r.cardId === link.cardId));
        created += (await this.cards.importFromBank(userId, link.cardId, rows)).created;
        await this.prisma.bankCardLink.update({ where: { id: link.id }, data: { lastSyncAt: new Date() } });
      }
    }

    await this.prisma.bankConnection.update({ where: { id }, data: { lastSyncAt: startedAt } });
    return { created, linkedAccounts: connection.links.length + connection.cardLinks.length };
  }

  private async getOwned(userId: string, id: string) {
    const connection = await this.prisma.bankConnection.findFirst({ where: { id, userId }, include: { links: true, cardLinks: true } });
    if (!connection) throw new NotFoundException('Conexão não encontrada');
    return connection;
  }
}
