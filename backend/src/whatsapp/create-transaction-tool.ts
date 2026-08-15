import type Anthropic from '@anthropic-ai/sdk';

/**
 * Única ferramenta exposta à Claude na conversa de WhatsApp. Ela só é
 * chamada quando o modelo já tem tipo, descrição, valor e conta definidos —
 * enquanto faltar algo (ex: qual conta), o modelo responde com texto puro
 * perguntando, sem chamar a ferramenta (ver WhatsappService.handleIncomingMessage).
 */
export const CREATE_TRANSACTION_TOOL: Anthropic.Tool = {
  name: 'create_transaction',
  description:
    'Registra uma transação (gasto ou receita) já confirmada no FinanceFlow. Só chame quando tiver certeza do tipo, descrição, valor e da conta a usar.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['EXPENSE', 'INCOME'],
        description: 'EXPENSE para gasto/despesa, INCOME para receita/entrada',
      },
      description: {
        type: 'string',
        description: 'Descrição curta do lançamento, ex: "Mercado", "Uber", "Salário"',
      },
      amount: {
        type: 'number',
        description: 'Valor em reais, sempre positivo',
      },
      accountId: {
        type: 'string',
        description: 'id de uma das contas informadas na lista de contas disponíveis',
      },
      categoryId: {
        type: 'string',
        description: 'id de uma das categorias informadas, se ficar óbvio qual usar. Pode ficar de fora.',
      },
      date: {
        type: 'string',
        description: 'Data do lançamento em formato AAAA-MM-DD. Se não for dita, usa a data de hoje.',
      },
      status: {
        type: 'string',
        enum: ['PAID', 'PENDING'],
        description: 'PAID se já aconteceu (padrão), PENDING se é algo a pagar/receber no futuro',
      },
    },
    required: ['type', 'description', 'amount', 'accountId'],
  },
};
