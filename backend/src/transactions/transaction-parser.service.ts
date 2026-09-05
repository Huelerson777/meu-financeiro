import { BadRequestException, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { PARSE_TRANSACTION_TOOL } from './parse-transaction-tool';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

export interface ParsedTransactionDraft {
  type: 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT';
  description: string;
  amount: number;
  date: string;
  status: 'PAID' | 'PENDING';
  accountId?: string;
  toAccountId?: string;
  cardId?: string;
  installmentsCount?: number;
  categoryId?: string;
}

/**
 * Interpreta texto livre ("blusa renner 100 cartao nubank") em um rascunho de
 * transação usando a mesma abordagem do fluxo de WhatsApp (tool use com a
 * Anthropic API, ver whatsapp.service.ts) — a IA recebe as contas/cartões/
 * categorias reais do usuário (com id) e escolhe entre elas, nunca inventa id.
 *
 * Diferente do WhatsApp, aqui não há conversa: a chamada é single-turn com
 * tool_choice forçado, e o resultado é sempre um rascunho pra revisão manual
 * (nunca salva direto), então campos incertos ficam em branco em vez de gerar
 * uma pergunta de volta.
 */
@Injectable()
export class TransactionParserService {
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(private prisma: PrismaService) {}

  async parse(userId: string, text: string): Promise<ParsedTransactionDraft> {
    const [accounts, cards, categories] = await Promise.all([
      this.prisma.account.findMany({ where: { userId, isArchived: false }, select: { id: true, name: true, type: true } }),
      this.prisma.card.findMany({ where: { userId, isArchived: false }, select: { id: true, name: true } }),
      this.prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
    ]);

    const response = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: this.buildSystemPrompt(accounts, cards, categories),
      messages: [{ role: 'user', content: text }],
      tools: [PARSE_TRANSACTION_TOOL],
      tool_choice: { type: 'tool', name: 'parse_transaction' },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) throw new BadRequestException('Não consegui interpretar esse texto. Tente descrever de outro jeito.');

    return this.buildDraft(toolUse.input as Record<string, unknown>, accounts, cards, categories);
  }

  private buildDraft(
    input: Record<string, unknown>,
    accounts: { id: string; name: string; type: string }[],
    cards: { id: string; name: string }[],
    categories: { id: string; name: string }[],
  ): ParsedTransactionDraft {
    const type =
      input.type === 'INCOME' || input.type === 'EXPENSE' || input.type === 'TRANSFER' || input.type === 'INVESTMENT'
        ? input.type
        : null;
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount);

    if (!type || !description || !amount || amount <= 0) {
      throw new BadRequestException('Não consegui identificar tipo, descrição e valor nesse texto.');
    }

    // Nunca confia cegamente no id que o modelo mandou — só aceita se for
    // realmente um dos ids das listas do próprio usuário buscadas acima.
    const account = typeof input.accountId === 'string' ? accounts.find((a) => a.id === input.accountId) : undefined;
    const category = typeof input.categoryId === 'string' ? categories.find((c) => c.id === input.categoryId) : undefined;

    const dateMatch = typeof input.date === 'string' ? /^\d{4}-\d{2}-\d{2}$/.exec(input.date) : null;
    const date = dateMatch ? input.date as string : new Date().toISOString().split('T')[0];

    // Transferência/investimento não têm cartão, categoria ou parcelas —
    // são sempre conta-a-conta.
    if (type === 'TRANSFER' || type === 'INVESTMENT') {
      const toAccount = typeof input.toAccountId === 'string' ? accounts.find((a) => a.id === input.toAccountId) : undefined;
      // Em INVESTMENT o destino só conta se for de fato uma conta de investimento —
      // senão fica em branco pra quem revisa escolher (mesma regra do formulário manual).
      const validToAccount = type === 'INVESTMENT' && toAccount?.type !== 'INVESTMENT' ? undefined : toAccount;

      return {
        type,
        description,
        amount,
        date,
        status: 'PAID',
        accountId: account?.id,
        toAccountId: validToAccount?.id,
      };
    }

    const card = typeof input.cardId === 'string' ? cards.find((c) => c.id === input.cardId) : undefined;
    const installmentsCount = card
      ? Math.min(48, Math.max(1, Math.round(Number(input.installmentsCount) || 1)))
      : undefined;

    return {
      type,
      description,
      amount,
      date,
      status: input.status === 'PENDING' ? 'PENDING' : 'PAID',
      // cartão tem prioridade se os dois vierem preenchidos: é o caso mais específico
      accountId: card ? undefined : account?.id,
      cardId: card?.id,
      installmentsCount,
      categoryId: category?.id,
    };
  }

  private buildSystemPrompt(
    accounts: { id: string; name: string; type: string }[],
    cards: { id: string; name: string }[],
    categories: { id: string; name: string }[],
  ): string {
    const accountsList =
      accounts.map((a) => `- ${a.name} (id: ${a.id})${a.type === 'INVESTMENT' ? ' [conta de investimento]' : ''}`).join('\n') ||
      '(nenhuma conta cadastrada)';
    const cardsList = cards.map((c) => `- ${c.name} (id: ${c.id})`).join('\n') || '(nenhum cartão cadastrado)';
    const categoriesList = categories.map((c) => `- ${c.name} (id: ${c.id})`).join('\n') || '(nenhuma categoria cadastrada)';

    return `Você interpreta um texto curto que um usuário do FinanceFlow digitou pra lançar um gasto, receita, transferência ou investimento rapidamente, ex: "blusa renner 100 cartao nubank", "recebi 15 da venda de um controle na conta nubank", "transferi 200 do nubank pro itau" ou "aportei 500 na xp vindo do nubank".

Contas disponíveis:
${accountsList}

Cartões de crédito disponíveis:
${cardsList}

Categorias disponíveis:
${categoriesList}

Data de hoje: ${new Date().toISOString().split('T')[0]}

Regras:
- Se o texto descrever mover dinheiro entre duas contas do próprio usuário (ex: "passei", "transferi", "movi"), use type TRANSFER: accountId é a conta de origem, toAccountId é a conta de destino.
- Se o texto descrever um aporte/investimento (ex: "investi", "apliquei", "aportei"), use type INVESTMENT: accountId é de onde saiu o dinheiro, toAccountId precisa ser uma das contas marcadas como [conta de investimento].
- Em TRANSFER e INVESTMENT nunca preencha cardId ou categoryId — não se aplicam.
- Se o texto mencionar cartão de crédito, preencha cardId (nunca accountId junto) — só vale para EXPENSE/INCOME.
- Se mencionar conta, pix, débito ou dinheiro, preencha accountId (nunca cardId junto).
- Se não ficar claro qual conta/cartão/destino usar, deixe em branco — quem revisa decide.
- Categoria é opcional (só em EXPENSE/INCOME) — use se ficar óbvio pela descrição, senão deixe de fora.
- Sempre chame a ferramenta parse_transaction, mesmo com campos incertos em branco.`;
  }
}
