import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { PluggyClient } from './pluggy.client';

const FIRST_SYNC_DAYS = 90;
// Reprocessa uma janela antes da última sincronização: lançamentos pendentes no banco só aparecem depois.
const OVERLAP_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class OpenFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggy: PluggyClient,
    private readonly transactions: TransactionsService,
  ) {}

  list(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      include: { links: true },
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
      supported: a.type === 'BANK',
      linkedAccountId: connection.links.find((l) => l.pluggyAccountId === a.id)?.accountId ?? null,
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

  /** Traz as transações novas de cada conta ligada. Não mexe em contas sem ligação. */
  async sync(userId: string, id: string) {
    const connection = await this.getOwned(userId, id);
    const from = new Date(
      connection.lastSyncAt ? connection.lastSyncAt.getTime() - OVERLAP_DAYS * DAY_MS : Date.now() - FIRST_SYNC_DAYS * DAY_MS,
    );
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

    await this.prisma.bankConnection.update({ where: { id }, data: { lastSyncAt: startedAt } });
    return { created, linkedAccounts: connection.links.length };
  }

  private async getOwned(userId: string, id: string) {
    const connection = await this.prisma.bankConnection.findFirst({ where: { id, userId }, include: { links: true } });
    if (!connection) throw new NotFoundException('Conexão não encontrada');
    return connection;
  }
}
