import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Definições das tools MCP expostas ao Claude — mesmo estilo (schema
 * descritivo, nunca confia cegamente num id) já usado em
 * transactions/parse-transaction-tool.ts e whatsapp/create-transaction-tool.ts,
 * só que aqui quem escolhe os valores é o próprio Claude (cliente MCP), não
 * uma chamada interna à Anthropic API. O dispatch de cada uma fica em
 * mcp-tools.service.ts.
 */

const TRANSACTION_ENTRY_SCHEMA = {
  type: 'object' as const,
  properties: {
    type: {
      type: 'string',
      enum: ['EXPENSE', 'INCOME', 'TRANSFER', 'INVESTMENT'],
      description:
        'EXPENSE (gasto) ou INCOME (receita) usam accountId. TRANSFER move dinheiro entre duas contas do usuário (accountId = origem, toAccountId = destino). INVESTMENT é um aporte (accountId = origem, toAccountId = conta de investimento de destino).',
    },
    description: { type: 'string', description: 'Descrição curta do lançamento' },
    amount: { type: 'number', description: 'Valor em reais, sempre positivo' },
    date: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
    status: {
      type: 'string',
      enum: ['PAID', 'PENDING'],
      description: 'PAID se já aconteceu (padrão), PENDING se é algo a pagar/receber no futuro. Não se aplica a TRANSFER/INVESTMENT.',
    },
    accountId: {
      type: 'string',
      description: 'id de uma conta (ver list_accounts) — obrigatório em todos os tipos (conta de origem em TRANSFER/INVESTMENT)',
    },
    toAccountId: {
      type: 'string',
      description: 'Só para TRANSFER/INVESTMENT: id da conta de destino (precisa ser do tipo INVESTMENT quando type=INVESTMENT)',
    },
    categoryId: {
      type: 'string',
      description: 'id de uma categoria (ver list_categories) — só se aplica a EXPENSE/INCOME, opcional',
    },
    force: {
      type: 'boolean',
      description:
        'Deixe de fora (ou false) na primeira tentativa. Antes de lançar, o servidor confere se já existe um lançamento igual (mesma conta, valor, descrição e dia) e, se achar, NÃO lança — devolve o existente pra você avisar o usuário e perguntar se quer lançar mesmo assim. Só mande true depois que o usuário confirmar isso.',
    },
  },
  required: ['type', 'description', 'amount', 'date', 'accountId'],
};

export const MCP_TOOLS: Tool[] = [
  {
    name: 'list_accounts',
    description: 'Lista as contas financeiras do usuário (banco, carteira, investimento...) com id, nome, tipo e saldo atual.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_categories',
    description: 'Lista as categorias de transação do usuário, com id, nome e cor.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_cards',
    description: 'Lista os cartões de crédito do usuário, com id, nome, limite, limite usado e datas de fechamento/vencimento.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_investment_positions',
    description: 'Lista as posições de investimento do usuário (ações, renda fixa, fundos...) com valor investido e valor atual.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_transactions',
    description:
      'Busca transações já lançadas, com filtros de período/descrição/valor. Use antes de importar um extrato pra checar se um lançamento já existe e evitar duplicidade.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'AAAA-MM-DD' },
        endDate: { type: 'string', description: 'AAAA-MM-DD' },
        search: { type: 'string', description: 'Busca por texto na descrição, conta ou categoria' },
        amount: { type: 'string', description: 'Filtra por valor (aceita contém, ex: "15" acha 15, 315, 1500)' },
        types: {
          type: 'array',
          items: { type: 'string', enum: ['EXPENSE', 'INCOME', 'TRANSFER', 'INVESTMENT'] },
          description: 'Filtra por um ou mais tipos',
        },
        status: { type: 'string', enum: ['PAID', 'PENDING', 'OVERDUE'] },
        page: { type: 'number', description: 'Padrão 1' },
        limit: { type: 'number', description: 'Padrão 20, máximo 100' },
      },
    },
  },
  {
    name: 'create_transaction',
    description:
      'Registra um único lançamento: gasto, receita, transferência entre contas ou aporte em investimento. Se já existir um lançamento igual (mesma conta/valor/descrição/dia), não lança nada e devolve o existente em "possibleDuplicate" — avise o usuário e só chame de novo com force:true se ele confirmar que quer lançar mesmo assim.',
    inputSchema: TRANSACTION_ENTRY_SCHEMA,
  },
  {
    name: 'create_transactions_batch',
    description:
      'Registra vários lançamentos de uma vez — use ao importar uma planilha ou extrato bancário colado/anexado na conversa. Cada item segue o mesmo formato de create_transaction. Itens que já existirem (mesma conta/valor/descrição/dia) NÃO são lançados e voltam em "possibleDuplicates" — mostre esses casos pro usuário e pergunte se quer lançar mesmo assim; se sim, chame de novo só com esses itens e force:true. Itens inválidos (em "failed") não impedem os demais de serem lançados.',
    inputSchema: {
      type: 'object',
      properties: {
        transactions: { type: 'array', items: TRANSACTION_ENTRY_SCHEMA, description: 'Lista de lançamentos a criar' },
      },
      required: ['transactions'],
    },
  },
  {
    name: 'create_card_purchase',
    description: 'Registra uma compra parcelada no cartão de crédito (ex: item de uma fatura importada).',
    inputSchema: {
      type: 'object',
      properties: {
        cardId: { type: 'string', description: 'id de um cartão (ver list_cards)' },
        description: { type: 'string' },
        totalAmount: { type: 'number', description: 'Valor TOTAL da compra (não o valor de cada parcela)' },
        installmentsCount: { type: 'number', description: 'Em quantas parcelas (1 a 48). Padrão 1.' },
        purchaseDate: { type: 'string', description: 'AAAA-MM-DD' },
        categoryId: { type: 'string', description: 'id de uma categoria, opcional' },
      },
      required: ['cardId', 'description', 'totalAmount', 'purchaseDate'],
    },
  },
  {
    name: 'create_installment_purchase',
    description: 'Registra um parcelamento FORA do cartão de crédito (financiamento, boleto parcelado, consórcio...).',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        installmentAmount: { type: 'number', description: 'Valor de CADA parcela' },
        totalInstallments: { type: 'number', description: 'Total de parcelas (1 a 600)' },
        startInstallment: {
          type: 'number',
          description: 'Número da primeira parcela a acompanhar (padrão 1 — use maior se parte já foi paga fora do sistema)',
        },
        firstDueDate: { type: 'string', description: 'AAAA-MM-DD, vencimento da parcela inicial (startInstallment)' },
        categoryId: { type: 'string', description: 'id de uma categoria, opcional' },
        accountId: { type: 'string', description: 'Conta sugerida pra pagamento das parcelas, opcional' },
      },
      required: ['description', 'installmentAmount', 'totalInstallments', 'firstDueDate'],
    },
  },
  {
    name: 'create_investment_position',
    description:
      'Registra um aporte/ativo de investimento (ex: a partir de uma nota de corretagem da B3 ou de um CDB). Omita fromAccountId para registrar um ativo já possuído, sem mover saldo de nenhuma conta.',
    inputSchema: {
      type: 'object',
      properties: {
        fromAccountId: { type: 'string', description: 'Conta de onde sai o dinheiro do aporte — omita se o ativo já era possuído' },
        toAccountId: { type: 'string', description: 'Conta de investimento (tipo INVESTMENT) que recebe o aporte' },
        amount: { type: 'number', description: 'Valor total aportado' },
        name: { type: 'string', description: 'Ex: "CDB Banco XP", "PETR4"' },
        category: { type: 'string', enum: ['STOCK', 'FIXED_INCOME', 'FUND', 'CRYPTO', 'REAL_ESTATE', 'OTHER'] },
        quantity: { type: 'number', description: 'Quantidade de cotas/ações — só STOCK/FUND' },
        ticker: { type: 'string', description: 'Ticker B3 (ex: PETR4) — só STOCK/FUND, ativa cotação automática' },
        indexer: { type: 'string', enum: ['CDI', 'SELIC', 'IPCA_PLUS', 'PREFIXADO'], description: 'Só FIXED_INCOME' },
        rate: { type: 'number', description: 'Taxa contratada — só FIXED_INCOME' },
        startDate: { type: 'string', description: 'AAAA-MM-DD, início da contagem de rendimento — só FIXED_INCOME' },
        date: { type: 'string', description: 'AAAA-MM-DD, data do aporte — padrão hoje' },
        currentAmount: { type: 'number', description: 'Valor atual do ativo, se já souber (útil pra ativo antigo)' },
        description: { type: 'string' },
      },
      required: ['toAccountId', 'amount', 'name', 'category'],
    },
  },
];
