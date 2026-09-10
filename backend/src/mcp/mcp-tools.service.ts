import { Injectable } from '@nestjs/common';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaService } from '../common/prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AccountsService } from '../accounts/accounts.service';
import { CategoriesService } from '../categories/categories.service';
import { CardsService } from '../cards/cards.service';
import { InvestmentsService } from '../investments/investments.service';
import { InstallmentPurchasesService } from '../installment-purchases/installment-purchases.service';
import { MCP_TOOLS } from './mcp-tool-definitions';

type TransactionEntry = {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT';
  description: string;
  amount: number;
  date: string;
  status?: 'PAID' | 'PENDING';
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
};

/**
 * Executa as tools MCP — cada handler chama diretamente o Service de domínio
 * já usado pelo resto do backend (sem HTTP interno), então toda validação de
 * posse/regra de negócio (ensureAccountOwnership, limite de cartão etc.) já
 * vem de graça. Nunca confia no id que o Claude mandou além do que o próprio
 * Service já valida.
 */
@Injectable()
export class McpToolsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private accountsService: AccountsService,
    private categoriesService: CategoriesService,
    private cardsService: CardsService,
    private investmentsService: InvestmentsService,
    private installmentPurchasesService: InstallmentPurchasesService,
  ) {}

  listToolDefinitions(): Tool[] {
    return MCP_TOOLS;
  }

  async callTool(userId: string, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    try {
      switch (name) {
        case 'list_accounts':
          return this.ok(await this.listAccounts(userId));
        case 'list_categories':
          return this.ok(await this.categoriesService.findAll(userId));
        case 'list_cards':
          return this.ok(await this.cardsService.findAll(userId));
        case 'list_investment_positions':
          return this.ok(await this.investmentsService.listPositions(userId));
        case 'search_transactions':
          return this.ok(await this.searchTransactions(userId, args));
        case 'create_transaction':
          return this.ok(await this.createEntry(userId, args as unknown as TransactionEntry));
        case 'create_transactions_batch':
          return this.ok(await this.createTransactionsBatch(userId, args));
        case 'create_card_purchase':
          return this.ok(await this.createCardPurchase(userId, args));
        case 'create_installment_purchase':
          return this.ok(await this.installmentPurchasesService.create(userId, args as any));
        case 'create_investment_position':
          return this.ok(await this.investmentsService.createPosition(userId, args as any));
        default:
          return this.error(`Tool desconhecida: ${name}`);
      }
    } catch (err) {
      return this.error((err as Error).message ?? 'Erro inesperado ao executar a tool');
    }
  }

  private async listAccounts(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isArchived: false },
      select: { id: true, name: true, type: true, currentBalance: true },
      orderBy: { name: 'asc' },
    });
    return accounts.map((a) => ({ ...a, currentBalance: Number(a.currentBalance) }));
  }

  private searchTransactions(userId: string, args: Record<string, unknown>) {
    return this.transactionsService.findAll(userId, {
      startDate: typeof args.startDate === 'string' ? args.startDate : undefined,
      endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
      search: typeof args.search === 'string' ? args.search : undefined,
      amount: typeof args.amount === 'string' ? args.amount : undefined,
      types: Array.isArray(args.types) ? (args.types as TransactionEntry['type'][]) : undefined,
      status: typeof args.status === 'string' ? (args.status as any) : undefined,
      page: typeof args.page === 'number' ? args.page : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    });
  }

  /**
   * Roteia um lançamento por `type`, mesma lógica de
   * transactions/transaction-parser.service.ts: EXPENSE/INCOME vão pro
   * TransactionsService; TRANSFER/INVESTMENT (aporte) vão pro
   * AccountsService.transfer (accountId = origem, toAccountId = destino).
   */
  private createEntry(userId: string, entry: TransactionEntry) {
    if (entry.type === 'TRANSFER' || entry.type === 'INVESTMENT') {
      if (!entry.toAccountId) throw new Error('toAccountId é obrigatório para TRANSFER/INVESTMENT');
      return this.accountsService.transfer(userId, {
        fromAccountId: entry.accountId,
        toAccountId: entry.toAccountId,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
      });
    }

    return this.transactionsService.create(userId, {
      type: entry.type,
      description: entry.description,
      amount: entry.amount,
      accountId: entry.accountId,
      categoryId: entry.categoryId,
      status: entry.status ?? 'PAID',
      date: `${entry.date}T12:00:00.000Z`,
    });
  }

  private async createTransactionsBatch(userId: string, args: Record<string, unknown>) {
    const entries = Array.isArray(args.transactions) ? (args.transactions as TransactionEntry[]) : [];
    const created: unknown[] = [];
    const failed: { index: number; error: string }[] = [];

    for (let index = 0; index < entries.length; index++) {
      try {
        created.push(await this.createEntry(userId, entries[index]));
      } catch (err) {
        failed.push({ index, error: (err as Error).message ?? 'Erro desconhecido' });
      }
    }

    return { createdCount: created.length, failedCount: failed.length, created, failed };
  }

  private createCardPurchase(userId: string, args: Record<string, unknown>) {
    const cardId = args.cardId as string;
    return this.cardsService.createPurchase(cardId, userId, {
      description: args.description as string,
      totalAmount: args.totalAmount as number,
      installmentsCount: (args.installmentsCount as number) ?? 1,
      purchaseDate: args.purchaseDate as string,
      categoryId: args.categoryId as string | undefined,
    });
  }

  private ok(data: unknown): CallToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  private error(message: string): CallToolResult {
    return { content: [{ type: 'text', text: message }], isError: true };
  }
}
