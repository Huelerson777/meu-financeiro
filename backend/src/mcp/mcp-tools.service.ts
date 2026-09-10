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
  /** Confirma o lançamento mesmo que já exista um possível duplicado (ver findPossibleDuplicate). */
  force?: boolean;
};

type CreateEntryResult =
  | { outcome: 'created'; transaction: unknown }
  | { outcome: 'possible_duplicate'; attempted: TransactionEntry; existing: unknown };

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
          return this.ok(await this.createSingleEntry(userId, args as unknown as TransactionEntry));
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
   *
   * Antes de criar, checa se já existe um lançamento igual (mesma conta,
   * valor, data e descrição) — se achar e `force` não vier true, NÃO cria:
   * devolve o existente pra quem chamou decidir (avisar o usuário e pedir
   * confirmação antes de tentar de novo com force:true). Evita duplicar
   * silenciosamente ao importar o mesmo extrato duas vezes.
   */
  private async createEntry(userId: string, entry: TransactionEntry): Promise<CreateEntryResult> {
    if (!entry.force) {
      const existing = await this.findPossibleDuplicate(userId, entry);
      if (existing) return { outcome: 'possible_duplicate', attempted: entry, existing };
    }

    if (entry.type === 'TRANSFER' || entry.type === 'INVESTMENT') {
      if (!entry.toAccountId) throw new Error('toAccountId é obrigatório para TRANSFER/INVESTMENT');
      const transaction = await this.accountsService.transfer(userId, {
        fromAccountId: entry.accountId,
        toAccountId: entry.toAccountId,
        amount: entry.amount,
        description: entry.description,
        date: entry.date,
      });
      return { outcome: 'created', transaction };
    }

    const transaction = await this.transactionsService.create(userId, {
      type: entry.type,
      description: entry.description,
      amount: entry.amount,
      accountId: entry.accountId,
      categoryId: entry.categoryId,
      status: entry.status ?? 'PAID',
      date: `${entry.date}T12:00:00.000Z`,
    });
    return { outcome: 'created', transaction };
  }

  /**
   * "Possível duplicado" = mesma conta, valor e descrição (sem diferenciar
   * maiúsculas/acentos/espaço nas pontas) já lançados no mesmo dia — critério
   * deliberadamente estrito (as 4 coisas juntas) pra não confundir duas
   * compras legítimas parecidas (ex: dois cafés de R$ 8 no mesmo dia) com uma
   * duplicata de importação.
   */
  private async findPossibleDuplicate(userId: string, entry: TransactionEntry) {
    const dayStart = new Date(`${entry.date}T00:00:00.000Z`);
    const dayEnd = new Date(`${entry.date}T23:59:59.999Z`);

    return this.prisma.transaction.findFirst({
      where: {
        userId,
        accountId: entry.accountId,
        // Comparar um número JS puro contra uma coluna Decimal(14,2) falha
        // silenciosamente (89.9 em ponto flutuante não é exatamente 89.90) —
        // precisa mandar como string de precisão fixa pro Postgres comparar certo.
        amount: entry.amount.toFixed(2),
        description: { equals: entry.description.trim(), mode: 'insensitive' },
        date: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, description: true, amount: true, date: true, status: true, type: true },
    });
  }

  private async createSingleEntry(userId: string, entry: TransactionEntry) {
    const result = await this.createEntry(userId, entry);
    if (result.outcome === 'created') return result.transaction;

    return {
      possibleDuplicate: true,
      existing: result.existing,
      note: 'Não lançado por já existir um lançamento igual (mesma conta, valor, descrição e dia). Confirme com o usuário e chame de novo com force:true se ele quiser lançar mesmo assim.',
    };
  }

  private async createTransactionsBatch(userId: string, args: Record<string, unknown>) {
    const entries = Array.isArray(args.transactions) ? (args.transactions as TransactionEntry[]) : [];
    const created: unknown[] = [];
    const possibleDuplicates: { index: number; attempted: TransactionEntry; existing: unknown }[] = [];
    const failed: { index: number; error: string }[] = [];

    for (let index = 0; index < entries.length; index++) {
      try {
        const result = await this.createEntry(userId, entries[index]);
        if (result.outcome === 'created') {
          created.push(result.transaction);
        } else {
          possibleDuplicates.push({ index, attempted: result.attempted, existing: result.existing });
        }
      } catch (err) {
        failed.push({ index, error: (err as Error).message ?? 'Erro desconhecido' });
      }
    }

    return {
      createdCount: created.length,
      possibleDuplicateCount: possibleDuplicates.length,
      failedCount: failed.length,
      created,
      possibleDuplicates,
      failed,
      note:
        possibleDuplicates.length > 0
          ? 'Itens em possibleDuplicates NÃO foram lançados por parecerem já existir. Mostre os detalhes pro usuário e, se ele confirmar que quer lançar mesmo assim, chame de novo só esses itens com force:true.'
          : undefined,
    };
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
